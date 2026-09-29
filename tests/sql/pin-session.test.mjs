import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { seedParent, asRole, expectError } from './harness.mjs';

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

export const tests = [
  {
    name: '1. Create session and validate',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const token = 'session_test_token_12345';
      const tokenHash = sha256(token);

      const expiresAt = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select public.parent_pin_session_create($1, $2, 30) as res`,
          [parentId, tokenHash]
        )).rows[0].res
      );
      assert.ok(expiresAt);

      const isValid = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select public.parent_pin_session_valid($1, $2) as res`,
          [parentId, tokenHash]
        )).rows[0].res
      );
      assert.equal(isValid, true);
    },
  },
  {
    name: '2. Expired session returns false and is cleaned up on next create',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const token = 'expired_token_abc';
      const tokenHash = sha256(token);

      // Create session with -5 minutes (already expired)
      await asRole(db, 'service_role', async () =>
        db.query(
          `select public.parent_pin_session_create($1, $2, -5)`,
          [parentId, tokenHash]
        )
      );

      const isValid = await asRole(db, 'service_role', async () =>
        (await db.query(
          `select public.parent_pin_session_valid($1, $2) as res`,
          [parentId, tokenHash]
        )).rows[0].res
      );
      assert.equal(isValid, false);

      // Creating a new session removes the expired one
      const token2 = 'fresh_token_def';
      const token2Hash = sha256(token2);
      await asRole(db, 'service_role', async () =>
        db.query(
          `select public.parent_pin_session_create($1, $2, 30)`,
          [parentId, token2Hash]
        )
      );

      const count = (await db.query(
        `select count(*)::int as count from public.parent_pin_sessions where parent_id = $1`,
        [parentId]
      )).rows[0].count;
      assert.equal(count, 1);
    },
  },
  {
    name: '3. Clear removes all sessions for parent',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const tokenHash = sha256('token_to_clear');

      await asRole(db, 'service_role', async () =>
        db.query(`select public.parent_pin_session_create($1, $2, 30)`, [parentId, tokenHash])
      );

      await asRole(db, 'service_role', async () =>
        db.query(`select public.parent_pin_sessions_clear($1)`, [parentId])
      );

      const isValid = await asRole(db, 'service_role', async () =>
        (await db.query(`select public.parent_pin_session_valid($1, $2) as res`, [parentId, tokenHash])).rows[0].res
      );
      assert.equal(isValid, false);

      const count = (await db.query(
        `select count(*)::int as count from public.parent_pin_sessions where parent_id = $1`,
        [parentId]
      )).rows[0].count;
      assert.equal(count, 0);
    },
  },
  {
    name: '4. Cross-parent token is invalid',
    fn: async (db) => {
      const parentA = await seedParent(db);
      const parentB = await seedParent(db);
      const tokenHash = sha256('parent_a_token');

      await asRole(db, 'service_role', async () =>
        db.query(`select public.parent_pin_session_create($1, $2, 30)`, [parentA, tokenHash])
      );

      const isValidForB = await asRole(db, 'service_role', async () =>
        (await db.query(`select public.parent_pin_session_valid($1, $2) as res`, [parentB, tokenHash])).rows[0].res
      );
      assert.equal(isValidForB, false);
    },
  },
  {
    name: '5. Table and function grants: anon and authenticated cannot access',
    fn: async (db) => {
      const parentId = await seedParent(db);
      const tokenHash = sha256('test');

      await asRole(db, 'anon', () =>
        expectError(
          db.query(`select * from public.parent_pin_sessions`),
          'permission denied'
        )
      );

      await asRole(db, 'authenticated', () =>
        expectError(
          db.query(`select * from public.parent_pin_sessions`),
          'permission denied'
        )
      );

      await asRole(db, 'anon', () =>
        expectError(
          db.query(`select public.parent_pin_session_valid($1, $2)`, [parentId, tokenHash]),
          'permission denied'
        )
      );

      await asRole(db, 'authenticated', () =>
        expectError(
          db.query(`select public.parent_pin_session_valid($1, $2)`, [parentId, tokenHash]),
          'permission denied'
        )
      );
    },
  },
];
