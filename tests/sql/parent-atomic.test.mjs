import assert from 'node:assert/strict';
import { seedParent, seedKid, asRole, expectError } from './harness.mjs';

export const tests = [
  {
    name: '1. parent_move_money: handles deposit and withdrawal, enforces invariant',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 20 });

      // Deposit
      const newBal1 = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select parent_move_money($1, $2, 'DEPOSIT', 15.50, 'Pocket money') as bal`,
          [kid.id, parentId]
        )).rows[0].bal
      );
      assert.equal(Number(newBal1), 35.50);

      // Withdrawal
      const newBal2 = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select parent_move_money($1, $2, 'WITHDRAWAL', 10.00, 'Stationery') as bal`,
          [kid.id, parentId]
        )).rows[0].bal
      );
      assert.equal(Number(newBal2), 25.50);

      // Verify transactions
      const txs = (await db.query(
        `select * from public.transactions where kid_id = $1`,
        [kid.id]
      )).rows;

      assert.equal(txs.length, 2);
      const depTx = txs.find((t) => t.type === 'DEPOSIT');
      const wdrTx = txs.find((t) => t.type === 'WITHDRAWAL');

      assert.ok(depTx);
      assert.equal(Number(depTx.amount), 15.50);
      assert.equal(depTx.label, 'Pocket money');

      assert.ok(wdrTx);
      assert.equal(Number(wdrTx.amount), 10.00);
      assert.equal(wdrTx.label, 'Stationery');

      // Invariant: initial (20) + deposit (15.50) - withdrawal (10) = 25.50
      const kidFinal = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidFinal.balance), 25.50);
    },
  },
  {
    name: '2. parent_move_money: insufficient_balance, wrong parent not_found, invalid type/amount',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const otherParentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 10 });

      // Insufficient balance
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select parent_move_money($1, $2, 'WITHDRAWAL', 25.00)`, [kid.id, parentId]),
          'insufficient_balance'
        )
      );

      // Balance unchanged and no tx written
      const kidAfter = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidAfter.balance), 10);
      const txCount = (await db.query(`select count(*) from public.transactions where kid_id = $1`, [kid.id])).rows[0].count;
      assert.equal(Number(txCount), 0);

      // Wrong parent
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select parent_move_money($1, $2, 'DEPOSIT', 5.00)`, [kid.id, otherParentId]),
          'not_found'
        )
      );

      // Invalid type
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select parent_move_money($1, $2, 'INVALID', 5.00)`, [kid.id, parentId]),
          'invalid_type'
        )
      );

      // Invalid amount (too low, negative, or too high)
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select parent_move_money($1, $2, 'DEPOSIT', 0.20)`, [kid.id, parentId]),
          'invalid_amount'
        )
      );
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select parent_move_money($1, $2, 'DEPOSIT', -5.00)`, [kid.id, parentId]),
          'invalid_amount'
        )
      );
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select parent_move_money($1, $2, 'DEPOSIT', 200000.00)`, [kid.id, parentId]),
          'invalid_amount'
        )
      );
    },
  },
  {
    name: '3. execute_due_hibahs: pays due hibahs, idempotent on second call, deactivates at end_date and on deleted kid',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid1 = await seedKid(db, parentId, { balance: 0 });
      const kid2 = await seedKid(db, parentId, { balance: 5 });

      // Two due hibahs
      await db.query(
        `insert into public.scheduled_hibahs (parent_id, kid_id, amount, frequency, start_date, next_run_at, is_active)
         values ($1, $2, 10.00, 'weekly', now() - interval '1 day', now() - interval '1 hour', true)`,
        [parentId, kid1.id]
      );
      await db.query(
        `insert into public.scheduled_hibahs (parent_id, kid_id, amount, frequency, start_date, next_run_at, is_active)
         values ($1, $2, 7.50, 'monthly', now() - interval '1 day', now() - interval '1 hour', true)`,
        [parentId, kid2.id]
      );

      // First run: processes 2
      const processed1 = await asRole(db, 'service_role', async () =>
        (await db.query(`select execute_due_hibahs() as count`)).rows[0].count
      );
      assert.equal(Number(processed1), 2);

      const bal1 = (await db.query(`select balance from public.kids where id = $1`, [kid1.id])).rows[0].balance;
      assert.equal(Number(bal1), 10.00);
      const bal2 = (await db.query(`select balance from public.kids where id = $1`, [kid2.id])).rows[0].balance;
      assert.equal(Number(bal2), 12.50);

      // Second run immediately: processes 0
      const processed2 = await asRole(db, 'service_role', async () =>
        (await db.query(`select execute_due_hibahs() as count`)).rows[0].count
      );
      assert.equal(Number(processed2), 0);

      // Test end_date deactivation: schedule with next run exceeding end_date
      const kid3 = await seedKid(db, parentId, { balance: 0 });
      const shEnd = (await db.query(
        `insert into public.scheduled_hibahs (parent_id, kid_id, amount, frequency, start_date, end_date, next_run_at, is_active)
         values ($1, $2, 5.00, 'weekly', now() - interval '2 days', now() + interval '1 day', now() - interval '1 hour', true)
         returning id`,
        [parentId, kid3.id]
      )).rows[0].id;

      await asRole(db, 'service_role', () => db.query(`select execute_due_hibahs()`));
      const shAfter = (await db.query(`select is_active from public.scheduled_hibahs where id = $1`, [shEnd])).rows[0];
      assert.equal(shAfter.is_active, false);

      // Test missing kid deactivation
      await db.query(`alter table public.scheduled_hibahs disable trigger all`);
      const missingKidId = '00000000-0000-0000-0000-000000000099';
      const shDead = (await db.query(
        `insert into public.scheduled_hibahs (parent_id, kid_id, amount, frequency, start_date, next_run_at, is_active)
         values ($1, $2, 5.00, 'daily', now() - interval '1 day', now() - interval '1 hour', true)
         returning id`,
        [parentId, missingKidId]
      )).rows[0].id;
      await db.query(`alter table public.scheduled_hibahs enable trigger all`);

      await asRole(db, 'service_role', () => db.query(`select execute_due_hibahs()`));
      const shDeadAfter = (await db.query(`select is_active from public.scheduled_hibahs where id = $1`, [shDead])).rows[0];
      assert.equal(shDeadAfter.is_active, false);
    },
  },
  {
    name: '4. delete_kid: cleans up all child tables and notifications/quiz_attempts; wrong parent raises not_found',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const otherParentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 10 });

      // Seed rows across tables
      await db.query(`insert into public.notifications (parent_id, kid_id, kind, message) values ($1, $2, 'TEST', 'msg')`, [parentId, kid.id]);
      await db.query(`insert into public.quiz_attempts (kid_id, question_index, question_text, correct) values ($1, 0, 'q', true)`, [kid.id]);
      await db.query(`insert into public.scheduled_hibahs (parent_id, kid_id, amount, frequency, start_date, next_run_at, is_active) values ($1, $2, 5, 'daily', now(), now(), true)`, [parentId, kid.id]);
      await db.query(`insert into public.transactions (kid_id, type, amount, label) values ($1, 'DEPOSIT', 10, 'dep')`, [kid.id]);
      await db.query(`insert into public.approvals (kid_id, kind, amount, reason, status) values ($1, 'DEPOSIT', 5, 'app', 'pending')`, [kid.id]);
      await db.query(`insert into public.rewards (kid_id, name, cost, status) values ($1, 'toy', 5, 'requested')`, [kid.id]);
      await db.query(`insert into public.goals (kid_id, name, target) values ($1, 'goal', 50)`, [kid.id]);
      await db.query(`insert into public.loans (kid_id, amount, due_date, reason) values ($1, 20, '2026-10-12', 'loan')`, [kid.id]);

      // Wrong parent raises not_found and deletes nothing
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select delete_kid($1, $2)`, [kid.id, otherParentId]),
          'not_found'
        )
      );

      const kidStillExists = (await db.query(`select id from public.kids where id = $1`, [kid.id])).rows;
      assert.equal(kidStillExists.length, 1);

      // Correct parent deletes everything
      await asRole(db, 'service_role', () =>
        db.query(`select delete_kid($1, $2)`, [kid.id, parentId])
      );

      assert.equal((await db.query(`select count(*) from public.kids where id = $1`, [kid.id])).rows[0].count, 0);
      assert.equal((await db.query(`select count(*) from public.notifications where kid_id = $1`, [kid.id])).rows[0].count, 0);
      assert.equal((await db.query(`select count(*) from public.quiz_attempts where kid_id = $1`, [kid.id])).rows[0].count, 0);
      assert.equal((await db.query(`select count(*) from public.scheduled_hibahs where kid_id = $1`, [kid.id])).rows[0].count, 0);
      assert.equal((await db.query(`select count(*) from public.transactions where kid_id = $1`, [kid.id])).rows[0].count, 0);
      assert.equal((await db.query(`select count(*) from public.approvals where kid_id = $1`, [kid.id])).rows[0].count, 0);
      assert.equal((await db.query(`select count(*) from public.rewards where kid_id = $1`, [kid.id])).rows[0].count, 0);
      assert.equal((await db.query(`select count(*) from public.goals where kid_id = $1`, [kid.id])).rows[0].count, 0);
      assert.equal((await db.query(`select count(*) from public.loans where kid_id = $1`, [kid.id])).rows[0].count, 0);
    },
  },
  {
    name: '5. Grants: anon and authenticated cannot call parent_move_money, execute_due_hibahs, delete_kid, or resolve_approval',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 10 });

      for (const role of ['anon', 'authenticated']) {
        await asRole(db, role, () =>
          expectError(
            db.query(`select parent_move_money($1, $2, 'DEPOSIT', 5.00)`, [kid.id, parentId]),
            'permission denied'
          )
        );
        await asRole(db, role, () =>
          expectError(
            db.query(`select execute_due_hibahs()`),
            'permission denied'
          )
        );
        await asRole(db, role, () =>
          expectError(
            db.query(`select delete_kid($1, $2)`, [kid.id, parentId]),
            'permission denied'
          )
        );
        await asRole(db, role, () =>
          expectError(
            db.query(`select resolve_approval($1, $2, true)`, [kid.id, parentId]),
            'permission denied'
          )
        );
      }
    },
  },
];
