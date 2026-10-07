import assert from 'node:assert/strict';
import { seedParent, seedKid } from './harness.mjs';
export const tests = [{name:'Quarter settlement preserves stored 90-day terms, waits for maturity and pays exactly once',fn:async db=>{
  const parent=await seedParent(db), kid=await seedKid(db,parent,{balance:100});
  // Simulate existing quarterly rows even on committed HEAD, whose new-position
  // options still omit quarters. This fixture DDL is not a production migration.
  const constraint=(await db.query("select pg_get_constraintdef(oid) as definition from pg_constraint where conname='investments_frequency_check'")).rows[0]?.definition;
  if(!constraint?.includes('quarter')) {
    await db.exec("alter table investments drop constraint if exists investments_frequency_check; alter table investments add constraint investments_frequency_check check(frequency is null or frequency in ('minute','day','week','quarter'));");
  }
  for(const ticks of [1,2,3,4]) {
  const inv=(await db.query("select kid_investment_open($1,'high','week',2,10) as data",[kid.id])).rows[0].data;
  await db.query("update investments set frequency='quarter',lock_ticks=$2,created_at=now()-interval '2 days' where id=$1",[inv.id,ticks]);
  const original=(await db.query('select min_rate,max_rate,protected,seed,lock_ticks from investments where id=$1',[inv.id])).rows[0];
  await db.query('select kid_investments_settle($1)',[kid.id]);
  assert.equal((await db.query('select status from investments where id=$1',[inv.id])).rows[0].status,'active');
  assert.deepEqual((await db.query('select min_rate,max_rate,protected,seed,lock_ticks from investments where id=$1',[inv.id])).rows[0],original);
  await db.query("update investments set created_at=now()-(lock_ticks*interval '90 days')-interval '1 day' where id=$1",[inv.id]);
  const expected=Number((await db.query("select round(value,2) as payout from investment_fund_path($1,now()) where tick=$2",[inv.id,ticks])).rows[0].payout);
  const before=Number((await db.query('select balance from kids where id=$1',[kid.id])).rows[0].balance);
  await db.query('select kid_investments_settle($1)',[kid.id]);
  const closed=(await db.query("select status,payout,closed_at=created_at+lock_ticks*interval '90 days' as correct_end from investments where id=$1",[inv.id])).rows[0];
  assert.equal(closed.status,'closed');assert.equal(closed.correct_end,true);assert.equal(Number(closed.payout),expected);
  await db.query('select kid_investments_settle($1)',[kid.id]);
  assert.equal(Math.round(Number((await db.query('select balance from kids where id=$1',[kid.id])).rows[0].balance)*100),Math.round(before*100)+Math.round(expected*100));
  }
}}];
