import assert from 'node:assert/strict';
import { asRole, expectError, seedParent, seedKid } from './harness.mjs';
export const tests = [{ name: "child creation cannot exceed ten rows per parent", async fn(db) {
  const parent=await seedParent(db); for(let i=0;i<10;i++)await seedKid(db,parent);
  await expectError(seedKid(db,parent),"kid_limit");
}}, { name: 'atomic rate counter allows two hits then denies with retry time', async fn(db) {
  for (let i=1;i<=3;i++) {
    const row = await asRole(db, 'service_role', () => db.query("select public.rate_limit_hit('test','synthetic',2,3600) as result"));
    assert.equal(row.rows[0].result.allowed, i <= 2);
    assert.equal(row.rows[0].result.hits, i);
    if (i===3) assert.ok(row.rows[0].result.retryAfter > 0);
  }
  await expectError(db.query("select public.rate_limit_hit('x','x',0,60)"), 'invalid_limit');
}}, { name: 'client roles cannot call or read rate limits', async fn(db) {
  for (const role of ['anon','authenticated']) await asRole(db, role, async () => {
    await expectError(db.query("select public.rate_limit_hit('x','x',2,60)"), 'permission denied');
    await expectError(db.query('select * from rate_limits'), 'permission denied');
  });
}}];
