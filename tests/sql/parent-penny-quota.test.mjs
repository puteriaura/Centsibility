import assert from 'node:assert/strict';
import { seedParent, asRole, expectError } from './harness.mjs';

export const tests = [
  {
    name: '1. Parent quota consumption: increments count, decrements remaining, raises quota_exceeded at limit',
    fn: async (db) => {
      const parentId = await seedParent(db);

      // Consume quota with limit 3
      const rem1 = await asRole(db, 'service_role', async () => {
        const res = await db.query(`select parent_consume_penny_quota($1, 3) as remaining`, [parentId]);
        return res.rows[0].remaining;
      });
      assert.equal(rem1, 2);

      const row1 = (await db.query(`select penny_ai_count, penny_ai_date from public.profiles where id = $1`, [parentId])).rows[0];
      assert.equal(row1.penny_ai_count, 1);
      assert.ok(row1.penny_ai_date);

      const rem2 = await asRole(db, 'service_role', async () => {
        const res = await db.query(`select parent_consume_penny_quota($1, 3) as remaining`, [parentId]);
        return res.rows[0].remaining;
      });
      assert.equal(rem2, 1);

      const rem3 = await asRole(db, 'service_role', async () => {
        const res = await db.query(`select parent_consume_penny_quota($1, 3) as remaining`, [parentId]);
        return res.rows[0].remaining;
      });
      assert.equal(rem3, 0);

      // 4th call exceeds quota
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select parent_consume_penny_quota($1, 3)`, [parentId]),
          'quota_exceeded'
        )
      );

      const rowFinal = (await db.query(`select penny_ai_count from public.profiles where id = $1`, [parentId])).rows[0];
      assert.equal(rowFinal.penny_ai_count, 3);
    },
  },
  {
    name: '2. Parent quota reset: resets count when date is yesterday in Asia/Kuala_Lumpur',
    fn: async (db) => {
      const parentId = await seedParent(db);

      // Set count to limit and date to yesterday
      await db.query(
        `update public.profiles
            set penny_ai_date = (now() at time zone 'Asia/Kuala_Lumpur')::date - 1,
                penny_ai_count = 30
          where id = $1`,
        [parentId]
      );

      // Call on today resets count and succeeds
      const rem = await asRole(db, 'service_role', async () => {
        const res = await db.query(`select parent_consume_penny_quota($1, 30) as remaining`, [parentId]);
        return res.rows[0].remaining;
      });
      assert.equal(rem, 29);

      const row = (await db.query(`select penny_ai_count, penny_ai_date from public.profiles where id = $1`, [parentId])).rows[0];
      assert.equal(row.penny_ai_count, 1);
    },
  },
  {
    name: '3. Parent quota validation: rejects invalid limits and unknown parent',
    fn: async (db) => {
      const parentId = await seedParent(db);

      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select parent_consume_penny_quota($1, 0)`, [parentId]),
          'invalid_limit'
        )
      );

      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select parent_consume_penny_quota($1, -5)`, [parentId]),
          'invalid_limit'
        )
      );

      const fakeId = '00000000-0000-0000-0000-000000000000';
      await asRole(db, 'service_role', () =>
        expectError(
          db.query(`select parent_consume_penny_quota($1, 30)`, [fakeId]),
          'not_found'
        )
      );
    },
  },
  {
    name: '4. Parent quota grants: anon and authenticated cannot call parent_consume_penny_quota, service_role can',
    fn: async (db) => {
      const parentId = await seedParent(db);

      await asRole(db, 'anon', async () => {
        let threw = false;
        try {
          await db.query(`select parent_consume_penny_quota($1, 30)`, [parentId]);
        } catch (err) {
          threw = true;
          assert.match(err.message, /permission denied/i);
        }
        assert.ok(threw, 'anon should be denied');
      });

      await asRole(db, 'authenticated', async () => {
        let threw = false;
        try {
          await db.query(`select parent_consume_penny_quota($1, 30)`, [parentId]);
        } catch (err) {
          threw = true;
          assert.match(err.message, /permission denied/i);
        }
        assert.ok(threw, 'authenticated should be denied');
      });

      // service_role succeeds
      await asRole(db, 'service_role', async () => {
        const res = await db.query(`select parent_consume_penny_quota($1, 30) as remaining`, [parentId]);
        assert.ok(res.rows[0].remaining !== undefined);
      });
    },
  },
];
