import assert from 'node:assert/strict';
import { seedParent, asRole, expectError } from './harness.mjs';

export const tests = [
  {
    name: '1. schema check: commander_pins has new columns and profiles.pin is dropped',
    fn: async (db) => {
      const pinCols = (await db.query(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = 'commander_pins'`
      )).rows.map((r) => r.column_name);

      assert.ok(pinCols.includes('failed_attempts'), 'failed_attempts column exists');
      assert.ok(pinCols.includes('locked_until'), 'locked_until column exists');

      const profileCols = (await db.query(
        `select column_name from information_schema.columns
         where table_schema = 'public' and table_name = 'profiles' and column_name = 'pin'`
      )).rows;

      assert.equal(profileCols.length, 0, 'profiles.pin has been dropped');
    },
  },
  {
    name: '2. table access revoked from anon and authenticated',
    fn: async (db) => {
      const parentId = await seedParent(db);
      await db.query(
        `insert into public.commander_pins (parent_id, pin_hash) values ($1, $2)`,
        [parentId, 'initial_hash']
      );

      await asRole(db, 'anon', () =>
        expectError(
          db.query(`select * from public.commander_pins`),
          'permission denied'
        )
      );

      await asRole(db, 'authenticated', () =>
        expectError(
          db.query(`select * from public.commander_pins`),
          'permission denied'
        )
      );

      await asRole(db, 'authenticated', () =>
        expectError(
          db.query(`update public.commander_pins set failed_attempts = 0`),
          'permission denied'
        )
      );
    },
  },
  {
    name: '3. begin_attempt: handles no_pin, attempts 1-5 ok, attempt 6 locked, and resets expired lock',
    fn: async (db) => {
      const parentId = await seedParent(db);

      // No pin set
      const noPinRes = (await db.query(
        `select parent_pin_begin_attempt($1) as res`,
        [parentId]
      )).rows[0].res;
      assert.equal(noPinRes.status, 'no_pin');

      // Set pin
      await db.query(
        `insert into public.commander_pins (parent_id, pin_hash) values ($1, $2)`,
        [parentId, 'bcrypt_hash_abc']
      );

      // Attempts 1 to 4
      for (let i = 1; i <= 4; i++) {
        const res = (await db.query(
          `select parent_pin_begin_attempt($1) as res`,
          [parentId]
        )).rows[0].res;
        assert.equal(res.status, 'ok');
        assert.equal(res.attempt, i);
        assert.equal(res.pin_hash, 'bcrypt_hash_abc');
      }

      // Attempt 5 -> triggers lock
      const fifthRes = (await db.query(
        `select parent_pin_begin_attempt($1) as res`,
        [parentId]
      )).rows[0].res;
      assert.equal(fifthRes.status, 'ok');
      assert.equal(fifthRes.attempt, 5);

      // Attempt 6 -> locked
      const sixthRes = (await db.query(
        `select parent_pin_begin_attempt($1) as res`,
        [parentId]
      )).rows[0].res;
      assert.equal(sixthRes.status, 'locked');
      assert.ok(sixthRes.retry_after_seconds > 0, 'has positive retry_after_seconds');

      // Fast-forward expired lock
      await db.query(
        `update public.commander_pins
         set locked_until = now() - interval '1 second'
         where parent_id = $1`,
        [parentId]
      );

      // Next attempt after expiry should reset and succeed with attempt 1
      const resetRes = (await db.query(
        `select parent_pin_begin_attempt($1) as res`,
        [parentId]
      )).rows[0].res;
      assert.equal(resetRes.status, 'ok');
      assert.equal(resetRes.attempt, 1);
    },
  },
  {
    name: '4. attempt_succeeded: resets failed_attempts and locked_until, optionally updates hash',
    fn: async (db) => {
      const parentId = await seedParent(db);
      await db.query(
        `insert into public.commander_pins (parent_id, pin_hash, failed_attempts) values ($1, $2, $3)`,
        [parentId, 'old_hash', 3]
      );

      // Succeed without new hash
      await db.query(`select parent_pin_attempt_succeeded($1)`, [parentId]);
      const row1 = (await db.query(`select * from public.commander_pins where parent_id = $1`, [parentId])).rows[0];
      assert.equal(Number(row1.failed_attempts), 0);
      assert.equal(row1.locked_until, null);
      assert.equal(row1.pin_hash, 'old_hash');

      // Set failed attempts again and succeed with new hash
      await db.query(`update public.commander_pins set failed_attempts = 4 where parent_id = $1`, [parentId]);
      await db.query(`select parent_pin_attempt_succeeded($1, $2)`, [parentId, 'new_hash_123']);
      const row2 = (await db.query(`select * from public.commander_pins where parent_id = $1`, [parentId])).rows[0];
      assert.equal(Number(row2.failed_attempts), 0);
      assert.equal(row2.locked_until, null);
      assert.equal(row2.pin_hash, 'new_hash_123');
    },
  },
  {
    name: '5. execute grants: anon and authenticated cannot execute begin_attempt or attempt_succeeded',
    fn: async (db) => {
      const parentId = await seedParent(db);

      await asRole(db, 'anon', () =>
        expectError(
          db.query(`select parent_pin_begin_attempt($1)`, [parentId]),
          'permission denied'
        )
      );

      await asRole(db, 'anon', () =>
        expectError(
          db.query(`select parent_pin_attempt_succeeded($1)`, [parentId]),
          'permission denied'
        )
      );

      await asRole(db, 'authenticated', () =>
        expectError(
          db.query(`select parent_pin_begin_attempt($1)`, [parentId]),
          'permission denied'
        )
      );

      await asRole(db, 'authenticated', () =>
        expectError(
          db.query(`select parent_pin_attempt_succeeded($1)`, [parentId]),
          'permission denied'
        )
      );
    },
  },
];
