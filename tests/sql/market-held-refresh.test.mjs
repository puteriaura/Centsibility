import assert from 'node:assert/strict';
import { asRole, expectError, seedKid, seedParent } from './harness.mjs';

export const tests = [{
  name: 'held refresh selects up to six distinct active holdings, missing and oldest first',
  async fn(db) {
    const kid = await seedKid(db, await seedParent(db));
    const held = ['SPUS', 'HLAL', 'UMMA', 'SPWO', 'SPSK', 'SPRE', 'SPTE', 'MSFT', 'AAPL'];
    for (const symbol of [...held, 'SPUS', 'TSLA']) {
      await db.query(
        `insert into public.investments
           (kid_id, mode, symbol, principal, status, entry_price, entry_price_at)
         values ($1, 'market', $2, 10, $3, 100, now())`,
        [kid.id, symbol, symbol === 'TSLA' ? 'closed' : 'active'],
      );
    }
    const cutoff = '2026-11-09T15:45:00Z';
    for (const [symbol, at] of [
      ['HLAL', '15:30'], ['UMMA', '15:31'], ['SPWO', '15:32'],
      ['SPSK', '15:33'], ['SPRE', '15:34'], ['SPTE', '15:45'], ['MSFT', '15:46'],
    ]) {
      await db.query('insert into public.market_quotes(symbol,price,fetched_at) values ($1,100,$2)',
        [symbol, `2026-11-09T${at}:00Z`]);
    }
    const candidates = () => db.query('select * from public.market_held_refresh_candidates($1)', [cutoff]);
    assert.deepEqual((await asRole(db, 'service_role', candidates)).rows.map(row => row.symbol),
      ['AAPL', 'SPUS', 'HLAL', 'UMMA', 'SPWO', 'SPSK']);
    await db.query("update public.investments set status='closed' where symbol in ('AAPL','SPUS','HLAL')");
    assert.deepEqual((await asRole(db, 'service_role', candidates)).rows.map(row => row.symbol),
      ['UMMA', 'SPWO', 'SPSK', 'SPRE', 'SPTE']);
    for (const role of ['anon', 'authenticated']) {
      await expectError(asRole(db, role, candidates), 'permission denied');
    }
  },
}];
