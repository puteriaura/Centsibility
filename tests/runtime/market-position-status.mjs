import assert from 'node:assert/strict';
import {sourceUrl} from './source-loader.mjs';
globalThis.Deno={env:{get:()=>''}};
const {formatInvestmentList}=await import(await sourceUrl('supabase/functions/_shared/investments.ts'));
let quote={symbol:'HLAL',price:110,previous_close:100,is_market_open:true,fetched_at:'2026-10-08T15:00:00Z',price_time:'2026-10-08T15:00:00Z'};
const admin={from(){return {select(){return this},eq(){return this},gte(){return this},order(){return this},maybeSingle(){return Promise.resolve({data:quote})},then(resolve,reject){return Promise.resolve({data:[]}).then(resolve,reject)}}}};
const position={id:'synthetic',mode:'market',status:'active',symbol:'HLAL',principal:10,entry_price:100,created_at:'2026-10-01T00:00:00Z'};
try {
  const [closed]=await formatInvestmentList(admin,[position],new Date('2026-10-09T10:00:00+08:00'));
  assert.equal(closed.isMarketOpen,false,'An intraday cached flag must not report open at 10am Malaysian time');
  assert.equal(closed.currentPrice,110,'Keep the saved quote, never substitute a closing display into valuation');
  assert.equal(closed.currentValue,11);
  assert.equal(closed.stale,true);
  const [open]=await formatInvestmentList(admin,[position],new Date('2026-10-08T23:00:00+08:00'));
  assert.equal(open.isMarketOpen,true);
  const [unknown]=await formatInvestmentList(admin,[position],new Date('2029-10-08T15:00:00Z'));
  assert.equal(unknown.isMarketOpen,null,'Unsupported calendar years must not claim an open session');
  quote={...quote,is_market_open:false};
  const [exceptional]=await formatInvestmentList(admin,[position],new Date('2026-10-08T23:00:00+08:00'));
  assert.equal(exceptional.isMarketOpen,false,'Preserve provider-reported closure during a core session');
  quote=null;
  const [missing]=await formatInvestmentList(admin,[position],new Date('2026-10-09T10:00:00+08:00'));
  assert.equal(missing.currentPrice,null);assert.equal(missing.currentValue,null);
  assert.equal(missing.isMarketOpen,null);
  console.log('PASS held Market position closure, stale/availability separation, unchanged valuation and unknown calendar');
} catch(error) {console.error(error.message);process.exitCode=1}
