import assert from 'node:assert/strict';
import { seedParent, seedKid, asRole, expectError } from './harness.mjs';

export const tests = [
  {
    name: '1. resolve_reward approve: coins drop by cost once; second approve raises already_resolved with coins unchanged',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { coins: 50 });
      const rewardRes = await db.query(
        `insert into public.rewards (kid_id, name, cost, status) values ($1, $2, $3, $4) returning id`,
        [kid.id, 'Sticker Pack', 20, 'requested']
      );
      const rewardId = rewardRes.rows[0].id;

      await asRole(db, 'service_role', () =>
        db.query(`select resolve_reward($1, $2, true)`, [rewardId, parentId])
      );

      const kidAfter = (await db.query(`select coins from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidAfter.coins), 30);

      const rewardAfter = (await db.query(`select status from public.rewards where id = $1`, [rewardId])).rows[0];
      assert.equal(rewardAfter.status, 'approved');

      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select resolve_reward($1, $2, true)`, [rewardId, parentId]),
          'already_resolved'
        )
      );

      const kidFinal = (await db.query(`select coins from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidFinal.coins), 30);
    },
  },
  {
    name: '2. resolve_reward decline, then approve: raises already_resolved',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { coins: 50 });
      const rewardRes = await db.query(
        `insert into public.rewards (kid_id, name, cost, status) values ($1, $2, $3, $4) returning id`,
        [kid.id, 'Board Game', 20, 'requested']
      );
      const rewardId = rewardRes.rows[0].id;

      await asRole(db, 'service_role', () =>
        db.query(`select resolve_reward($1, $2, false)`, [rewardId, parentId])
      );

      const rewardAfter = (await db.query(`select status from public.rewards where id = $1`, [rewardId])).rows[0];
      assert.equal(rewardAfter.status, 'declined');

      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select resolve_reward($1, $2, true)`, [rewardId, parentId]),
          'already_resolved'
        )
      );
    },
  },
  {
    name: '3. resolve_reward not enough coins: insufficient_coins and reward stays requested',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { coins: 10 });
      const rewardRes = await db.query(
        `insert into public.rewards (kid_id, name, cost, status) values ($1, $2, $3, $4) returning id`,
        [kid.id, 'Book', 20, 'requested']
      );
      const rewardId = rewardRes.rows[0].id;

      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select resolve_reward($1, $2, true)`, [rewardId, parentId]),
          'insufficient_coins'
        )
      );

      const rewardAfter = (await db.query(`select status from public.rewards where id = $1`, [rewardId])).rows[0];
      assert.equal(rewardAfter.status, 'requested');

      const kidAfter = (await db.query(`select coins from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidAfter.coins), 10);
    },
  },
  {
    name: '4. resolve_reward wrong parent id: not_found and nothing changes',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const otherParentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { coins: 50 });
      const rewardRes = await db.query(
        `insert into public.rewards (kid_id, name, cost, status) values ($1, $2, $3, $4) returning id`,
        [kid.id, 'Toy Car', 20, 'requested']
      );
      const rewardId = rewardRes.rows[0].id;

      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select resolve_reward($1, $2, true)`, [rewardId, otherParentId]),
          'not_found'
        )
      );

      const rewardAfter = (await db.query(`select status from public.rewards where id = $1`, [rewardId])).rows[0];
      assert.equal(rewardAfter.status, 'requested');

      const kidAfter = (await db.query(`select coins from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidAfter.coins), 50);
    },
  },
  {
    name: '5. resolve_approval WITHDRAWAL: balance drops, one WITHDRAWAL transaction written, second call raises already_resolved',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 100 });
      const apRes = await db.query(
        `insert into public.approvals (kid_id, kind, amount, reason, status) values ($1, $2, $3, $4, $5) returning id`,
        [kid.id, 'WITHDRAWAL', 30, 'Pocket money', 'pending']
      );
      const approvalId = apRes.rows[0].id;

      await asRole(db, 'service_role', () =>
        db.query(`select resolve_approval($1, $2, true)`, [approvalId, parentId])
      );

      const kidAfter = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidAfter.balance), 70);

      const txs = (await db.query(
        `select * from public.transactions where kid_id = $1`,
        [kid.id]
      )).rows;
      assert.equal(txs.length, 1);
      assert.equal(txs[0].type, 'WITHDRAWAL');
      assert.equal(Number(txs[0].amount), 30);
      assert.equal(txs[0].label, 'Pocket money');

      const apAfter = (await db.query(`select status from public.approvals where id = $1`, [approvalId])).rows[0];
      assert.equal(apAfter.status, 'approved');

      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select resolve_approval($1, $2, true)`, [approvalId, parentId]),
          'already_resolved'
        )
      );
    },
  },
  {
    name: '6. resolve_approval WITHDRAWAL larger than balance: insufficient_balance and stays pending',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 20 });
      const apRes = await db.query(
        `insert into public.approvals (kid_id, kind, amount, reason, status) values ($1, $2, $3, $4, $5) returning id`,
        [kid.id, 'WITHDRAWAL', 50, 'Big toy', 'pending']
      );
      const approvalId = apRes.rows[0].id;

      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select resolve_approval($1, $2, true)`, [approvalId, parentId]),
          'insufficient_balance'
        )
      );

      const apAfter = (await db.query(`select status from public.approvals where id = $1`, [approvalId])).rows[0];
      assert.equal(apAfter.status, 'pending');

      const kidAfter = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidAfter.balance), 20);
    },
  },
  {
    name: '7. resolve_approval DEPOSIT: balance rises and one DEPOSIT transaction written',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 20 });
      const apRes = await db.query(
        `insert into public.approvals (kid_id, kind, amount, reason, status) values ($1, $2, $3, $4, $5) returning id`,
        [kid.id, 'DEPOSIT', 15, 'Allowance', 'pending']
      );
      const approvalId = apRes.rows[0].id;

      await asRole(db, 'service_role', () =>
        db.query(`select resolve_approval($1, $2, true)`, [approvalId, parentId])
      );

      const kidAfter = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidAfter.balance), 35);

      const txs = (await db.query(
        `select * from public.transactions where kid_id = $1`,
        [kid.id]
      )).rows;
      assert.equal(txs.length, 1);
      assert.equal(txs[0].type, 'DEPOSIT');
      assert.equal(Number(txs[0].amount), 15);
      assert.equal(txs[0].label, 'Allowance');
    },
  },
  {
    name: '8. resolve_approval QARD with loan terms: loans row created with amount equal to requested amount',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 10 });
      const apRes = await db.query(
        `insert into public.approvals (kid_id, kind, amount, reason, status) values ($1, $2, $3, $4, $5) returning id`,
        [kid.id, 'QARD', 100, 'Bicycle (due 14d) :: SIG::data:image/png;base64,xyz', 'pending']
      );
      const approvalId = apRes.rows[0].id;

      await asRole(db, 'service_role', () =>
        db.query(
          `select resolve_approval($1, $2, true, $3, $4, $5)`,
          [approvalId, parentId, '2026-10-11', 'Bicycle', 'data:image/png;base64,xyz']
        )
      );

      const loans = (await db.query(
        `select * from public.loans where kid_id = $1`,
        [kid.id]
      )).rows;
      assert.equal(loans.length, 1);
      assert.equal(Number(loans[0].amount), 100);
      assert.equal(loans[0].reason, 'Bicycle');
      const dueDateStr = loans[0].due_date instanceof Date ? loans[0].due_date.toISOString().slice(0, 10) : String(loans[0].due_date).slice(0, 10);
      assert.equal(dueDateStr, '2026-10-11');
      assert.equal(loans[0].signature_data_url, 'data:image/png;base64,xyz');

      const apAfter = (await db.query(`select status from public.approvals where id = $1`, [approvalId])).rows[0];
      assert.equal(apAfter.status, 'approved');
    },
  },
  {
    name: '9. Grants: anon and authenticated cannot call functions, service_role can',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 10, coins: 10 });
      const dummyUuid = '00000000-0000-0000-0000-000000000000';

      for (const role of ['anon', 'authenticated']) {
        await asRole(db, role, async () => {
          await expectError(
            db.query(`select resolve_approval($1, $2, true)`, [dummyUuid, parentId]),
            'permission denied'
          );
          await expectError(
            db.query(`select resolve_reward($1, $2, true)`, [dummyUuid, parentId]),
            'permission denied'
          );
          await expectError(
            db.query(`select adjust_kid_balance($1, $2)`, [kid.id, 5]),
            'permission denied'
          );
          await expectError(
            db.query(`select adjust_kid_coins($1, $2)`, [kid.id, 5]),
            'permission denied'
          );
        });
      }

      await asRole(db, 'service_role', async () => {
        await db.query(`select adjust_kid_balance($1, $2)`, [kid.id, 5]);
        await db.query(`select adjust_kid_coins($1, $2)`, [kid.id, 5]);
      });

      const kidAfter = (await db.query(`select balance, coins from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidAfter.balance), 15);
      assert.equal(Number(kidAfter.coins), 15);
    },
  },
];
