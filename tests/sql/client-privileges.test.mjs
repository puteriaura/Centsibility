import assert from 'node:assert/strict';
import { seedParent, seedKid, asRole, expectError } from './harness.mjs';

export const tests = [{
  name: 'parent secrets and writes are denied while safe own-child columns remain readable',
  async fn(db) {
    const parent = await seedParent(db), other = await seedParent(db);
    const kid = await seedKid(db, parent, { hashed_pin: 'synthetic-hash' });
    await seedKid(db, other);
    await db.query("select set_config('request.jwt.claim.sub', $1, false)", [parent]);
    await asRole(db, 'authenticated', async () => {
      await expectError(db.query('update profiles set penny_ai_count = 0'), 'permission denied');
      for (const column of ['session_token', 'hashed_pin', 'bridge_key_hash', 'failed_login_attempts', 'locked_until', '*']) {
        await expectError(db.query(`select ${column} from kids`), 'permission denied');
      }
      const rows = (await db.query('select id, has_pin, name from kids')).rows;
      assert.equal(rows.length, 1); assert.equal(rows[0].id, kid.id); assert.equal(rows[0].has_pin, true);
      await expectError(db.query("insert into notifications (parent_id, kind, message) values ($1, 'test', 'test')", [parent]), 'permission denied');
      await expectError(db.query('select * from child_creation_keys'), 'permission denied');
      await expectError(db.query('delete from quiz_attempts'), 'permission denied');
    });
  },
}, {
  name: 'anonymous clients cannot read public tables',
  async fn(db) {
    await asRole(db, 'anon', async () => {
      for (const table of ['kids', 'profiles', 'transactions']) await expectError(db.query(`select * from ${table}`), 'permission denied');
    });
  },
}];
