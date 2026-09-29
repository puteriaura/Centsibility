import assert from 'node:assert/strict';
import { seedParent, seedKid, asRole, expectError } from './harness.mjs';

export const tests = [
  {
    name: '1. kid_create_goal and kid_update_goal with refund (invariant: GOAL_OUT equals balance change)',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 50.00 });

      // Create goal
      const goalId = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_create_goal($1, 'New Bicycle', '🚲', 100.00) as id`,
          [kid.id]
        )).rows[0].id
      );

      assert.ok(goalId);

      const goalRow = (await db.query(`select * from public.goals where id = $1`, [goalId])).rows[0];
      assert.equal(goalRow.name, 'New Bicycle');
      assert.equal(goalRow.emoji, '🚲');
      assert.equal(Number(goalRow.target), 100.00);
      assert.equal(Number(goalRow.saved), 0);

      // Simulate saving RM40 into this goal
      await db.query(`update public.goals set saved = 40.00 where id = $1`, [goalId]);

      // Update goal: lower target to RM25 (should refund RM15)
      const res = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_update_goal($1, $2, 'Used Bicycle', '🚲', 25.00) as result`,
          [kid.id, goalId]
        )).rows[0].result
      );

      assert.equal(Number(res.saved), 25.00);
      assert.equal(Number(res.refunded), 15.00);

      // Check kid balance: was 50, refunded 15 => 65
      const kidAfter = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidAfter.balance), 65.00);

      // Check GOAL_OUT ledger row
      const txs = (await db.query(
        `select * from public.transactions where kid_id = $1 and type = 'GOAL_OUT'`,
        [kid.id]
      )).rows;
      assert.equal(txs.length, 1);
      assert.equal(Number(txs[0].amount), 15.00);
      assert.equal(txs[0].label, 'Moved back from Used Bicycle');

      // Update goal without lowering below saved (target 30 >= saved 25): no refund
      const res2 = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_update_goal($1, $2, 'Cool Bicycle', '🚴', 30.00) as result`,
          [kid.id, goalId]
        )).rows[0].result
      );
      assert.equal(Number(res2.saved), 25.00);
      assert.equal(Number(res2.refunded), 0);

      // Balance remains 65
      const kidAfter2 = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidAfter2.balance), 65.00);
    },
  },
  {
    name: '2. kid_delete_goal refunds saved amount to wallet via GOAL_OUT',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId, { balance: 40.00 });

      // Create goal and set saved to RM35
      const goalId = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_create_goal($1, 'Lego Castle', '🏰', 150.00) as id`,
          [kid.id]
        )).rows[0].id
      );
      await db.query(`update public.goals set saved = 35.00 where id = $1`, [goalId]);

      // Delete goal
      const res = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_delete_goal($1, $2) as result`,
          [kid.id, goalId]
        )).rows[0].result
      );
      assert.equal(Number(res.refunded), 35.00);

      // Goal row deleted
      const checkGoal = (await db.query(`select * from public.goals where id = $1`, [goalId])).rows;
      assert.equal(checkGoal.length, 0);

      // Balance increased from 40 to 75
      const kidAfter = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidAfter.balance), 75.00);

      // Transaction row written
      const tx = (await db.query(
        `select * from public.transactions where kid_id = $1 and type = 'GOAL_OUT' and amount = 35.00`,
        [kid.id]
      )).rows[0];
      assert.ok(tx);
      assert.equal(tx.label, 'Moved back from Lego Castle');

      // Deleting a goal with saved = 0 refunds 0
      const emptyGoalId = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_create_goal($1, 'Empty Goal', '🎯', 50.00) as id`,
          [kid.id]
        )).rows[0].id
      );
      const resEmpty = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_delete_goal($1, $2) as result`,
          [kid.id, emptyGoalId]
        )).rows[0].result
      );
      assert.equal(Number(resEmpty.refunded), 0);
      const kidAfterEmpty = (await db.query(`select balance from public.kids where id = $1`, [kid.id])).rows[0];
      assert.equal(Number(kidAfterEmpty.balance), 75.00);
    },
  },
  {
    name: '3. validation failures: name length, target limits, and max 10 goals',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId);

      // Name empty
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_create_goal($1, '', '🎯', 50)`, [kid.id]),
          'invalid_goal'
        )
      );

      // Name whitespace only
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_create_goal($1, '   ', '🎯', 50)`, [kid.id]),
          'invalid_goal'
        )
      );

      // Name > 40 chars
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_create_goal($1, $2, '🎯', 50)`, [kid.id, 'A'.repeat(41)]),
          'invalid_goal'
        )
      );

      // Target < 1
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_create_goal($1, 'Valid Name', '🎯', 0.50)`, [kid.id]),
          'invalid_goal'
        )
      );

      // Target > 100,000
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_create_goal($1, 'Valid Name', '🎯', 100001)`, [kid.id]),
          'invalid_goal'
        )
      );

      // Create 10 goals (limit)
      for (let i = 1; i <= 10; i++) {
        await asRole(db, 'service_role', () =>
          db.query(`select kid_create_goal($1, $2, '🎯', 50)`, [kid.id, `Goal ${i}`])
        );
      }

      // 11th goal fails
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_create_goal($1, 'Goal 11', '🎯', 50)`, [kid.id]),
          'invalid_goal'
        )
      );
    },
  },
  {
    name: '4. wrong kid raises not_found',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid1 = await seedKid(db, parentId);
      const kid2 = await seedKid(db, parentId);

      const fakeKidId = '00000000-0000-0000-0000-000000000000';

      // Create on non-existent kid
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_create_goal($1, 'Goal', '🎯', 50)`, [fakeKidId]),
          'not_found'
        )
      );

      // Create goal on kid1
      const goalId = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select kid_create_goal($1, 'Kid1 Goal', '🎯', 50) as id`,
          [kid1.id]
        )).rows[0].id
      );

      // Update goal passing kid2's id -> not_found
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_update_goal($1, $2, 'Renamed', '🎯', 60)`, [kid2.id, goalId]),
          'not_found'
        )
      );

      // Delete goal passing kid2's id -> not_found
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select kid_delete_goal($1, $2)`, [kid2.id, goalId]),
          'not_found'
        )
      );
    },
  },
  {
    name: '5. grants: anon and authenticated cannot call goal RPCs, service_role can',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const kid = await seedKid(db, parentId);

      // anon blocked
      await asRole(db, 'anon', () =>
        expectError(
          db.query(`select kid_create_goal($1, 'Goal', '🎯', 50)`, [kid.id]),
          'permission denied'
        )
      );

      // authenticated blocked
      await asRole(db, 'authenticated', () =>
        expectError(
          db.query(`select kid_create_goal($1, 'Goal', '🎯', 50)`, [kid.id]),
          'permission denied'
        )
      );

      await asRole(db, 'authenticated', () =>
        expectError(
          db.query(
            `select kid_update_goal($1, '00000000-0000-0000-0000-000000000000', 'Goal', '🎯', 50)`,
            [kid.id]
          ),
          'permission denied'
        )
      );

      await asRole(db, 'authenticated', () =>
        expectError(
          db.query(
            `select kid_delete_goal($1, '00000000-0000-0000-0000-000000000000')`,
            [kid.id]
          ),
          'permission denied'
        )
      );
    },
  },
];
