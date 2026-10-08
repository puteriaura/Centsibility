import assert from 'node:assert/strict';
import { sourceUrl } from './source-loader.mjs';
globalThis.Deno = { env: { get: () => '' } };
const { formatInvestmentList, currentInvestmentValues } = await import(await sourceUrl('supabase/functions/_shared/investments.ts'));
const legacy = { id:'synthetic', mode:'fund', principal:10, status:'active', tier:'high', frequency:'week', lock_ticks:4, created_at:'2099-01-01T00:00:00Z', seed:'private' };
const rows = [{ tick:1, tick_at:'2099-01-08T00:00:00Z', rate:0.02, value:10.2 }];
const admin = {
  rpc: async name => { assert.equal(name, 'investment_fund_path'); return {data:rows}; },
  from: () => { const query = {select:()=>query,eq:()=>query,order:()=>Promise.resolve({data:[legacy]})}; return query; },
};
const [result] = await formatInvestmentList(admin,[legacy]);
assert.equal(result.protected,true);
assert.equal(result.currentValue,10.2);
assert.equal(result.endsAt,'2099-01-29T00:00:00.000Z');
assert.equal(result.seed,undefined);
assert.equal(legacy.protected,undefined,'never mutate the stored/raw row');
assert.equal((await formatInvestmentList(admin,[{...legacy,protected:false}]))[0].protected,false);
assert.equal((await formatInvestmentList(admin,[{...legacy,mode:'other'}]))[0].protected,undefined);
const quarter={...legacy,frequency:'quarter',lock_ticks:1};
assert.equal((await formatInvestmentList(admin,[quarter]))[0].endsAt,'2099-04-01T00:00:00.000Z');
const quarterAdmin={...admin,from:()=>{const q={select:()=>q,eq:()=>q,order:()=>Promise.resolve({data:[quarter]})};return q;}};
assert.equal((await currentInvestmentValues(quarterAdmin,'synthetic')).investments[0].endsAt,'2099-04-01T00:00:00.000Z');
assert.equal((await formatInvestmentList(admin,[{...legacy,status:'closed',payout:11}]))[0].currentValue,11);
console.log('PASS legacy principal-floor display, explicit unprotected contracts, immutable raw rows, original 90-day quarters and stored closed payouts; mocked RPC only.');
