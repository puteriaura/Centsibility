import assert from 'node:assert/strict';
import { seedParent, seedKid, asRole, expectError } from './harness.mjs';

export const tests = [
  {
    name: '1. authenticated parent cannot perform direct writes on money tables',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 50, coins: 100 });

      // Seed an approval, reward, loan, goal, scheduled_hibah as superuser/service_role
      const approval = (await db.query(
        `insert into public.approvals (kid_id, kind, amount, reason, status)
         values ($1, 'WITHDRAWAL', 10, 'Book', 'approved')
         returning *`,
        [kid.id]
      )).rows[0];

      const reward = (await db.query(
        `insert into public.rewards (kid_id, name, cost, status)
         values ($1, 'Toy', 50, 'approved')
         returning *`,
        [kid.id]
      )).rows[0];

      const loan = (await db.query(
        `insert into public.loans (kid_id, amount, repaid, due_date, status)
         values ($1, 20, 10, '2026-12-31', 'active')
         returning *`,
        [kid.id]
      )).rows[0];

      const goal = (await db.query(
        `insert into public.goals (kid_id, name, emoji, target, saved)
         values ($1, 'Bike', '🚲', 100, 20)
         returning *`,
        [kid.id]
      )).rows[0];

      const hibah = (await db.query(
        `insert into public.scheduled_hibahs (parent_id, kid_id, amount, frequency, start_date, next_run_at)
         values ($1, $2, 10, 'weekly', now(), now())
         returning *`,
        [parentId, kid.id]
      )).rows[0];

      // Now set parent context and switch to authenticated role
      await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [parentId]);

      await asRole(db, 'authenticated', async () => {
        // 1. updating kids.balance
        await expectError(
          db.query(`update public.kids set balance = 999 where id = $1`, [kid.id]),
          'permission denied'
        );

        // 2. updating kids.coins
        await expectError(
          db.query(`update public.kids set coins = 999 where id = $1`, [kid.id]),
          'permission denied'
        );

        // 3. inserting into transactions
        await expectError(
          db.query(
            `insert into public.transactions (kid_id, type, amount, label)
             values ($1, 'DEPOSIT', 500, 'Direct exploit')`,
            [kid.id]
          ),
          'permission denied'
        );

        // 4. updating approvals.status back to pending
        await expectError(
          db.query(`update public.approvals set status = 'pending' where id = $1`, [approval.id]),
          'permission denied'
        );

        // 5. updating rewards.status back to requested
        await expectError(
          db.query(`update public.rewards set status = 'requested' where id = $1`, [reward.id]),
          'permission denied'
        );

        // 6. updating loans.repaid
        await expectError(
          db.query(`update public.loans set repaid = 0 where id = $1`, [loan.id]),
          'permission denied'
        );

        // 7. inserting into goals
        await expectError(
          db.query(
            `insert into public.goals (kid_id, name, emoji, target)
             values ($1, 'Direct Goal', '🎯', 50)`,
            [kid.id]
          ),
          'permission denied'
        );

        // 8. inserting into scheduled_hibahs
        await expectError(
          db.query(
            `insert into public.scheduled_hibahs (parent_id, kid_id, amount, frequency, start_date, next_run_at)
             values ($1, $2, 15, 'monthly', now(), now())`,
            [parentId, kid.id]
          ),
          'permission denied'
        );
      });
    },
  },
  {
    name: '2. parent SELECT works under RLS for own rows and hides other parents rows',
    fn: async (db) => {
      const parent1 = await seedParent(db);
      const parent2 = await seedParent(db);
      const kid1 = await seedKid(db, parent1, { balance: 10 });
      const kid2 = await seedKid(db, parent2, { balance: 20 });

      // Goals
      await db.query(
        `insert into public.goals (kid_id, name, emoji, target, saved)
         values ($1, 'P1 Goal', '🎯', 50, 5), ($2, 'P2 Goal', '🚀', 100, 10)`,
        [kid1.id, kid2.id]
      );

      // Scheduled hibahs
      await db.query(
        `insert into public.scheduled_hibahs (parent_id, kid_id, amount, frequency, start_date, next_run_at)
         values ($1, $2, 5, 'weekly', now(), now()), ($3, $4, 10, 'weekly', now(), now())`,
        [parent1, kid1.id, parent2, kid2.id]
      );

      // Set auth as parent1
      await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [parent1]);

      await asRole(db, 'authenticated', async () => {
        // Can see own kid
        const kids = (await db.query(`select * from public.kids`)).rows;
        assert.equal(kids.length, 1);
        assert.equal(kids[0].id, kid1.id);

        // Can see own kid's goals
        const goals = (await db.query(`select * from public.goals`)).rows;
        assert.equal(goals.length, 1);
        assert.equal(goals[0].name, 'P1 Goal');

        // Can see own scheduled hibahs
        const hibahs = (await db.query(`select * from public.scheduled_hibahs`)).rows;
        assert.equal(hibahs.length, 1);
        assert.equal(Number(hibahs[0].amount), 5);
      });

      // Switch auth to parent2
      await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [parent2]);

      await asRole(db, 'authenticated', async () => {
        const kids = (await db.query(`select * from public.kids`)).rows;
        assert.equal(kids.length, 1);
        assert.equal(kids[0].id, kid2.id);

        const goals = (await db.query(`select * from public.goals`)).rows;
        assert.equal(goals.length, 1);
        assert.equal(goals[0].name, 'P2 Goal');

        const hibahs = (await db.query(`select * from public.scheduled_hibahs`)).rows;
        assert.equal(hibahs.length, 1);
        assert.equal(Number(hibahs[0].amount), 10);
      });
    },
  },
  {
    name: '3. anon role has no read access to protected tables and write attempts fail',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 30 });

      // Clear JWT claim
      await db.query(`select set_config('request.jwt.claim.sub', '', false)`);

      await asRole(db, 'anon', async () => {
        // SELECT returns empty under RLS
        const kids = (await db.query(`select * from public.kids`)).rows;
        assert.equal(kids.length, 0);

        const goals = (await db.query(`select * from public.goals`)).rows;
        assert.equal(goals.length, 0);

        const hibahs = (await db.query(`select * from public.scheduled_hibahs`)).rows;
        assert.equal(hibahs.length, 0);

        // Direct writes fail with permission denied
        await expectError(
          db.query(`update public.kids set balance = 999 where id = $1`, [kid.id]),
          'permission denied'
        );
        await expectError(
          db.query(
            `insert into public.transactions (kid_id, type, amount, label)
             values ($1, 'DEPOSIT', 10, 'test')`,
            [kid.id]
          ),
          'permission denied'
        );
      });
    },
  },
  {
    name: '4. scheduled_hibahs_amount_positive check constraint blocks non-positive amounts',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId);

      // amount = 0 fails
      await expectError(
        db.query(
          `insert into public.scheduled_hibahs (parent_id, kid_id, amount, frequency, start_date, next_run_at)
           values ($1, $2, 0, 'weekly', now(), now())`,
          [parentId, kid.id]
        ),
        'scheduled_hibahs_amount_positive'
      );

      // amount < 0 fails
      await expectError(
        db.query(
          `insert into public.scheduled_hibahs (parent_id, kid_id, amount, frequency, start_date, next_run_at)
           values ($1, $2, -5, 'weekly', now(), now())`,
          [parentId, kid.id]
        ),
        'scheduled_hibahs_amount_positive'
      );

      // amount > 0 succeeds
      const res = await db.query(
        `insert into public.scheduled_hibahs (parent_id, kid_id, amount, frequency, start_date, next_run_at)
         values ($1, $2, 5.50, 'weekly', now(), now())
         returning id`,
        [parentId, kid.id]
      );
      assert.ok(res.rows[0].id);
    },
  },
  {
    name: '5. parent read coverage for approvals, rewards, loans, and transactions under RLS',
    fn: async (db) => {
      const parent1 = await seedParent(db);
      const parent2 = await seedParent(db);
      const kid1 = await seedKid(db, parent1, { name: 'Kid One', balance: 10 });
      const kid2 = await seedKid(db, parent2, { name: 'Kid Two', balance: 20 });

      // Seed approvals for kid1 and kid2
      const app1 = (await db.query(
        `insert into public.approvals (kid_id, kind, amount, reason, status)
         values ($1, 'WITHDRAWAL', 10, 'Book 1', 'pending')
         returning *`,
        [kid1.id]
      )).rows[0];
      const app2 = (await db.query(
        `insert into public.approvals (kid_id, kind, amount, reason, status)
         values ($1, 'WITHDRAWAL', 15, 'Book 2', 'pending')
         returning *`,
        [kid2.id]
      )).rows[0];

      // Seed rewards for kid1 and kid2
      const rew1 = (await db.query(
        `insert into public.rewards (kid_id, name, cost, status)
         values ($1, 'Toy 1', 50, 'requested')
         returning *`,
        [kid1.id]
      )).rows[0];
      const rew2 = (await db.query(
        `insert into public.rewards (kid_id, name, cost, status)
         values ($1, 'Toy 2', 60, 'requested')
         returning *`,
        [kid2.id]
      )).rows[0];

      // Seed loans for kid1 and kid2
      const loan1 = (await db.query(
        `insert into public.loans (kid_id, amount, repaid, due_date, status)
         values ($1, 20, 5, '2026-12-31', 'active')
         returning *`,
        [kid1.id]
      )).rows[0];
      const loan2 = (await db.query(
        `insert into public.loans (kid_id, amount, repaid, due_date, status)
         values ($1, 30, 10, '2026-12-31', 'active')
         returning *`,
        [kid2.id]
      )).rows[0];

      // Seed transactions for kid1 and kid2
      const tx1 = (await db.query(
        `insert into public.transactions (kid_id, type, amount, label)
         values ($1, 'DEPOSIT', 25, 'Allowance 1')
         returning *`,
        [kid1.id]
      )).rows[0];
      const tx2 = (await db.query(
        `insert into public.transactions (kid_id, type, amount, label)
         values ($1, 'DEPOSIT', 35, 'Allowance 2')
         returning *`,
        [kid2.id]
      )).rows[0];

      // Set auth as parent1
      await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [parent1]);

      await asRole(db, 'authenticated', async () => {
        // approvals: parent1 sees only kid1
        const approvals = (await db.query(`select * from public.approvals`)).rows;
        assert.equal(approvals.length, 1);
        assert.equal(approvals[0].id, app1.id);
        assert.equal(approvals[0].kid_id, kid1.id);

        // rewards: parent1 sees only kid1
        const rewards = (await db.query(`select * from public.rewards`)).rows;
        assert.equal(rewards.length, 1);
        assert.equal(rewards[0].id, rew1.id);
        assert.equal(rewards[0].kid_id, kid1.id);

        // loans: parent1 sees only kid1
        const loans = (await db.query(`select * from public.loans`)).rows;
        assert.equal(loans.length, 1);
        assert.equal(loans[0].id, loan1.id);
        assert.equal(loans[0].kid_id, kid1.id);

        // transactions: parent1 sees only kid1
        const transactions = (await db.query(`select * from public.transactions`)).rows;
        assert.equal(transactions.length, 1);
        assert.equal(transactions[0].id, tx1.id);
        assert.equal(transactions[0].kid_id, kid1.id);

        // Join query works and returns kid name
        const joinRes = (await db.query(
          `select a.*, k.name as kid_name from public.approvals a join public.kids k on k.id = a.kid_id`
        )).rows;
        assert.equal(joinRes.length, 1);
        assert.equal(joinRes[0].id, app1.id);
        assert.equal(joinRes[0].kid_name, 'Kid One');
      });

      // Switch auth to parent2
      await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [parent2]);

      await asRole(db, 'authenticated', async () => {
        // approvals: parent2 sees only kid2
        const approvals = (await db.query(`select * from public.approvals`)).rows;
        assert.equal(approvals.length, 1);
        assert.equal(approvals[0].id, app2.id);
        assert.equal(approvals[0].kid_id, kid2.id);

        // rewards: parent2 sees only kid2
        const rewards = (await db.query(`select * from public.rewards`)).rows;
        assert.equal(rewards.length, 1);
        assert.equal(rewards[0].id, rew2.id);
        assert.equal(rewards[0].kid_id, kid2.id);

        // loans: parent2 sees only kid2
        const loans = (await db.query(`select * from public.loans`)).rows;
        assert.equal(loans.length, 1);
        assert.equal(loans[0].id, loan2.id);
        assert.equal(loans[0].kid_id, kid2.id);

        // transactions: parent2 sees only kid2
        const transactions = (await db.query(`select * from public.transactions`)).rows;
        assert.equal(transactions.length, 1);
        assert.equal(transactions[0].id, tx2.id);
        assert.equal(transactions[0].kid_id, kid2.id);

        // Join query works and returns kid name
        const joinRes = (await db.query(
          `select a.*, k.name as kid_name from public.approvals a join public.kids k on k.id = a.kid_id`
        )).rows;
        assert.equal(joinRes.length, 1);
        assert.equal(joinRes[0].id, app2.id);
        assert.equal(joinRes[0].kid_name, 'Kid Two');
      });
    },
  },
];
