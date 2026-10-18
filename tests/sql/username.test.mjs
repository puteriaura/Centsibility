import assert from 'node:assert/strict';
import { seedParent, seedKid, expectError } from './harness.mjs';
export const tests = [{name:'case-insensitive uniqueness prevents Aiman alongside aiman',async fn(db){
  const parent=await seedParent(db);await seedKid(db,parent,{username:'aiman'});
  await expectError(seedKid(db,parent,{username:'Aiman'}),'duplicate key');
  assert.equal((await db.query("select count(*)::int as n from kids where lower(username)='aiman'")).rows[0].n,1);
}}, {name:'legacy usernames do not prevent unrelated balance updates',async fn(db){
  const kid=await seedKid(db,await seedParent(db),{username:'legacy name'});
  await db.query('update kids set balance=balance+1 where id=$1',[kid.id]);
  assert.equal(Number((await db.query('select balance from kids where id=$1',[kid.id])).rows[0].balance),1);
}}];
