import assert from 'node:assert/strict';
export const tests=[{name:'forward catalogue migration adds 15 dated screened stocks without changing Fund options',fn:async db=>{
 const {rows}=await db.query("select symbol, halal_source, halal_checked_on::text as checked from market_symbols where symbol in ('AVGO','MU','AMD','LLY','XOM','JNJ','ABBV','CSCO','AMAT','LRCX','MRK','PG','PANW','HD','CRWD')");
 assert.equal(rows.length,15);assert.ok(rows.every(r=>r.checked==='2026-10-07'&&r.halal_source.includes('https://www.sp-funds.com/SPUS/')));
 const {rows:all}=await db.query('select symbol from market_symbols where active');assert.equal(all.length,27);
 const {rows:options}=await db.query('select investment_fund_options() as options');
 assert.ok(!JSON.stringify(options).includes('quarter'));
}}];
