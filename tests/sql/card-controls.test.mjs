import assert from 'node:assert/strict';
import { seedParent, seedKid, asRole, expectError } from './harness.mjs';

export const tests = [
  {
    name: '1. Freeze: frozen card blocks sadaqah and withdrawal requests; unfreezing restores them',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 100, card_frozen: true });

      // Sadaqah blocked
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_give_sadaqah($1, 10.00)`, [kid.id]),
          'card_frozen'
        )
      );

      // Withdrawal request blocked
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_request_withdrawal($1, 10.00, 'cash')`, [kid.id]),
          'card_frozen'
        )
      );

      // No ledger rows or approvals created; balance unchanged
      const txsCount = (await db.query(`select count(*) from public.transactions where kid_id = $1`, [kid.id])).rows[0].count;
      assert.equal(Number(txsCount), 0);
      const apCount = (await db.query(`select count(*) from public.approvals where kid_id = $1`, [kid.id])).rows[0].count;
      assert.equal(Number(apCount), 0);
      const kidBal = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0].balance;
      assert.equal(Number(kidBal), 100);

      // Unfreeze card
      await asRole(db, 'service_role', () =>
        db.query(`select kid_set_card_controls($1, false)`, [kid.id])
      );

      // Now both succeed
      await asRole(db, 'service_role', () =>
        db.query(`select kid_give_sadaqah($1, 10.00)`, [kid.id])
      );
      const apId = await asRole(db, 'service_role', async () =>
        (await db.query(`select kid_request_withdrawal($1, 10.00, 'cash') as id`, [kid.id])).rows[0].id
      );
      assert.ok(apId);
    },
  },
  {
    name: '2. Daily limit of 50: sadaqah 30 ok, withdrawal 25 fails, 20 ok, declined withdrawal frees capacity',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 100, card_daily_limit: 50 });

      // Sadaqah RM30 allowed (spent: 30 / 50)
      await asRole(db, 'service_role', () =>
        db.query(`select kid_give_sadaqah($1, 30.00)`, [kid.id])
      );

      const spent1 = await asRole(db, 'service_role', async () =>
        (await db.query(`select kid_card_spent_today($1) as val`, [kid.id])).rows[0].val
      );
      assert.equal(Number(spent1), 30.00);

      // Withdrawal request of RM25 rejected (30 + 25 = 55 > 50)
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_request_withdrawal($1, 25.00, 'toy')`, [kid.id]),
          'card_limit_exceeded'
        )
      );

      // Withdrawal request of RM20 allowed (30 + 20 = 50 <= 50)
      const apId = await asRole(db, 'service_role', async () =>
        (await db.query(`select kid_request_withdrawal($1, 20.00, 'book') as id`, [kid.id])).rows[0].id
      );
      assert.ok(apId);

      const spent2 = await asRole(db, 'service_role', async () =>
        (await db.query(`select kid_card_spent_today($1) as val`, [kid.id])).rows[0].val
      );
      assert.equal(Number(spent2), 50.00);

      // Now at limit: further request of even RM1 fails
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_give_sadaqah($1, 1.00)`, [kid.id]),
          'card_limit_exceeded'
        )
      );

      // Parent declines the withdrawal approval
      await db.query(`update public.approvals set status = 'declined' where id = $1`, [apId]);

      // Spent drops back to 30.00
      const spent3 = await asRole(db, 'service_role', async () =>
        (await db.query(`select kid_card_spent_today($1) as val`, [kid.id])).rows[0].val
      );
      assert.equal(Number(spent3), 30.00);

      // A further RM20 is now allowed
      await asRole(db, 'service_role', () =>
        db.query(`select kid_give_sadaqah($1, 20.00)`, [kid.id])
      );

      const spentFinal = await asRole(db, 'service_role', async () =>
        (await db.query(`select kid_card_spent_today($1) as val`, [kid.id])).rows[0].val
      );
      assert.equal(Number(spentFinal), 50.00);
    },
  },
  {
    name: '3. Day boundary: rows dated yesterday (Asia/Kuala_Lumpur) do not count towards today limit',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 200, card_daily_limit: 50 });

      // Insert yesterday's SADAQAH transaction of RM40
      await db.query(
        `insert into public.transactions (kid_id, type, amount, label, created_at)
         values ($1, 'SADAQAH', 40.00, 'Yesterday Sadaqah', now() - interval '2 days')`,
        [kid.id]
      );

      // Insert yesterday's pending WITHDRAWAL approval of RM40
      await db.query(
        `insert into public.approvals (kid_id, kind, amount, reason, status, created_at)
         values ($1, 'WITHDRAWAL', 40.00, 'Yesterday Cash', 'pending', now() - interval '2 days')`,
        [kid.id]
      );

      // Spent today should be 0
      const spentToday = await asRole(db, 'service_role', async () =>
        (await db.query(`select kid_card_spent_today($1) as val`, [kid.id])).rows[0].val
      );
      assert.equal(Number(spentToday), 0.00);

      // Full daily limit of RM50 is available today
      await asRole(db, 'service_role', () =>
        db.query(`select kid_give_sadaqah($1, 50.00)`, [kid.id])
      );

      const spentAfter = await asRole(db, 'service_role', async () =>
        (await db.query(`select kid_card_spent_today($1) as val`, [kid.id])).rows[0].val
      );
      assert.equal(Number(spentAfter), 50.00);
    },
  },
  {
    name: '4. Validation: rejects limits outside 10-200, partial update preserves unchanged fields',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, {
        card_frozen: false,
        card_daily_limit: 50,
        card_online_enabled: true,
      });

      // Reject limit < 10
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_set_card_controls($1, null, 5)`, [kid.id]),
          'invalid_limit'
        )
      );

      // Reject limit > 200
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_set_card_controls($1, null, 250)`, [kid.id]),
          'invalid_limit'
        )
      );

      // Partial update: freeze card only
      const res1 = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_set_card_controls($1, true) as data`,
          [kid.id]
        )).rows[0].data
      );
      assert.equal(res1.card_frozen, true);
      assert.equal(Number(res1.card_daily_limit), 50);
      assert.equal(res1.card_online_enabled, true);

      // Partial update: change limit only
      const res2 = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_set_card_controls($1, null, 120) as data`,
          [kid.id]
        )).rows[0].data
      );
      assert.equal(res2.card_frozen, true);
      assert.equal(Number(res2.card_daily_limit), 120);
      assert.equal(res2.card_online_enabled, true);

      // Partial update: change onlineEnabled only
      const res3 = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_set_card_controls($1, null, null, false) as data`,
          [kid.id]
        )).rows[0].data
      );
      assert.equal(res3.card_frozen, true);
      assert.equal(Number(res3.card_daily_limit), 120);
      assert.equal(res3.card_online_enabled, false);
    },
  },
  {
    name: '5. Parent card override: parent sets controls and locks them; wrong parent raises not_found',
    fn: async (db) => {
      const parent1 = await seedParent(db);
      const parent2 = await seedParent(db);
      const kid = await seedKid(db, parent1, {
        balance: 100,
        card_frozen: true,
        card_daily_limit: 50,
        card_online_enabled: true,
        card_controls_locked: false,
      });

      // Wrong parent raises not_found
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(
            `select parent_set_card_controls($1, $2, false, 80, false, true)`,
            [kid.id, parent2]
          ),
          'not_found'
        )
      );

      // Non-existent kid raises not_found
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(
            `select parent_set_card_controls(gen_random_uuid(), $1, false, 80, false, true)`,
            [parent1]
          ),
          'not_found'
        )
      );

      // Invalid limit raises invalid_limit
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(
            `select parent_set_card_controls($1, $2, null, 5, null, null)`,
            [kid.id, parent1]
          ),
          'invalid_limit'
        )
      );
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(
            `select parent_set_card_controls($1, $2, null, 250, null, null)`,
            [kid.id, parent1]
          ),
          'invalid_limit'
        )
      );

      // Valid parent update: unfreeze, set limit 80, disable online, lock settings
      const res = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select parent_set_card_controls($1, $2, false, 80, false, true) as data`,
          [kid.id, parent1]
        )).rows[0].data
      );
      assert.equal(res.card_frozen, false);
      assert.equal(Number(res.card_daily_limit), 80);
      assert.equal(res.card_online_enabled, false);
      assert.equal(res.card_controls_locked, true);

      // Verify row in database
      const row = (await db.query(`select * from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(row.card_frozen, false);
      assert.equal(Number(row.card_daily_limit), 80);
      assert.equal(row.card_online_enabled, false);
      assert.equal(row.card_controls_locked, true);
    },
  },
  {
    name: '6. Child locking enforcement: tightening allowed, loosening raises card_locked',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, {
        balance: 100,
        card_frozen: false,
        card_daily_limit: 80,
        card_online_enabled: false,
        card_controls_locked: true,
      });

      // 1. Tightening is allowed: child freezes card
      const resFreeze = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_set_card_controls($1, true) as data`,
          [kid.id]
        )).rows[0].data
      );
      assert.equal(resFreeze.card_frozen, true);

      // 2. Tightening is allowed: child lowers limit from 80 to 40
      const resLimit = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_set_card_controls($1, null, 40) as data`,
          [kid.id]
        )).rows[0].data
      );
      assert.equal(Number(resLimit.card_daily_limit), 40);

      // 3. Loosening attempt 1: unfreezing while frozen raises card_locked
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_set_card_controls($1, false)`, [kid.id]),
          'card_locked'
        )
      );

      // 4. Loosening attempt 2: raising limit (from 40 to 60) raises card_locked
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_set_card_controls($1, null, 60)`, [kid.id]),
          'card_locked'
        )
      );

      // 5. Loosening attempt 3: turning online purchases on while disabled raises card_locked
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_set_card_controls($1, null, null, true)`, [kid.id]),
          'card_locked'
        )
      );

      // Setting same limit (40) is not loosening and succeeds
      const resSame = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_set_card_controls($1, null, 40) as data`,
          [kid.id]
        )).rows[0].data
      );
      assert.equal(Number(resSame.card_daily_limit), 40);

      // Lowering limit even further (to 10) succeeds
      const resLowest = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_set_card_controls($1, null, 10) as data`,
          [kid.id]
        )).rows[0].data
      );
      assert.equal(Number(resLowest.card_daily_limit), 10);
    },
  },
  {
    name: '7. Grants: anon and authenticated cannot call parent_set_card_controls or kid_set_card_controls',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId);

      await asRole(db, 'anon', async () => {
        await expectError(
          db.query(
            `select parent_set_card_controls($1, $2, true, 50, false, false)`,
            [kid.id, parentId]
          ),
          'permission denied'
        );
        await expectError(
          db.query(`select kid_set_card_controls($1, true)`, [kid.id]),
          'permission denied'
        );
      });

      await asRole(db, 'authenticated', async () => {
        await expectError(
          db.query(
            `select parent_set_card_controls($1, $2, true, 50, false, false)`,
            [kid.id, parentId]
          ),
          'permission denied'
        );
        await expectError(
          db.query(`select kid_set_card_controls($1, true)`, [kid.id]),
          'permission denied'
        );
      });
    },
  },
];

