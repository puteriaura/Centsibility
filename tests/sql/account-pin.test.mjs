import assert from 'node:assert/strict';
import { seedParent, seedKid, asRole, expectError } from './harness.mjs';
export const tests = [{
  name: 'parallel outcomes count twice; two sessions converge; expiry, success and hash changes are safe',
  async fn(db) {
    const parent = await seedParent(db);
    const kid = await seedKid(db, parent, { hashed_pin: 'audit-hash' });
    const fail = () => db.query("select kid_pin_result($1, 'audit-hash', false) as data", [kid.id]);
    const results = await Promise.all([fail(), fail()]);
    assert.deepEqual(results.map(r => r.rows[0].data.attemptsLeft).sort(), [3, 4]);
    const read = async () => (await db.query("select pin_account_status('kid', $1) as data", [kid.id])).rows[0].data;
    const [sessionA, sessionB] = await Promise.all([read(), read()]);
    assert.equal(sessionA.attemptsLeft, 3);
    assert.deepEqual(sessionA, sessionB);
    await fail(); await fail(); await fail();
    assert.ok((await read()).lockedUntil);
    assert.equal((await db.query("select kid_pin_result($1, 'audit-hash', true) as data", [kid.id])).rows[0].data.status, 'locked');
    await db.query("update kids set locked_until = now() - interval '1 minute' where id = $1", [kid.id]);
    assert.equal((await read()).attemptsLeft, 5);
    assert.equal((await fail()).rows[0].data.attemptsLeft, 4);
    assert.equal((await db.query("select kid_pin_result($1, 'audit-hash', true) as data", [kid.id])).rows[0].data.attemptsLeft, 5);
    assert.equal((await db.query("select kid_pin_result($1, 'old-hash', true) as data", [kid.id])).rows[0].data.status, 'changed');
    await asRole(db, 'authenticated', () => expectError(fail(), 'permission denied'));
  },
}];
