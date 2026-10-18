import assert from 'node:assert/strict';
import { seedParent, seedKid, asRole, expectError } from './harness.mjs';
export const tests = [{name:'child sessions are private, capped at five, and cascade on deletion', async fn(db) {
  const parent=await seedParent(db),kid=await seedKid(db,parent,{hashed_pin:'synthetic-hash'});
  for(let i=1;i<=6;i++)await asRole(db,'service_role',()=>db.query('select public.kid_session_create($1,$2,$3)',[kid.id,i.toString(16).padStart(64,'0'),'synthetic-hash']));
  assert.equal((await db.query('select count(*)::int as n from kid_sessions where kid_id=$1 and revoked_at is null',[kid.id])).rows[0].n,5);
  for(const role of ['anon','authenticated'])await asRole(db,role,async()=>{
    await expectError(db.query('select * from kid_sessions'),'permission denied');
    await expectError(db.query('select public.kid_session_create($1,$2,$3)',[kid.id,'f'.repeat(64),'synthetic-hash']),'permission denied');
  });
  await db.query('delete from kids where id=$1',[kid.id]);
  assert.equal((await db.query('select count(*)::int as n from kid_sessions where kid_id=$1',[kid.id])).rows[0].n,0);
}}, {name:'PIN reset cannot issue a new session using an old verified hash',async fn(db){
  const kid=await seedKid(db,await seedParent(db),{hashed_pin:'new-synthetic-hash'});
  await expectError(db.query('select public.kid_session_create($1,$2,$3)',[kid.id,'e'.repeat(64),'old-synthetic-hash']),'session_invalid');
}}];
