import assert from 'node:assert/strict';
import { asRole, seedParent } from './harness.mjs';
export const tests = [{ name: 'avatar bucket keeps public URLs while limiting size, MIME types and listing', async fn(db) {
  const bucket = (await db.query("select public, file_size_limit, allowed_mime_types from storage.buckets where id='avatars'")).rows[0];
  assert.equal(bucket.public,true); assert.equal(Number(bucket.file_size_limit),2097152);
  assert.deepEqual(bucket.allowed_mime_types,['image/webp','image/jpeg','image/png']);
  const parent = await seedParent(db), other = await seedParent(db);
  await db.query("insert into storage.objects (bucket_id,name) values ('avatars',$1),('avatars',$2),('avatars','kids/synthetic-kid/photo.png')",[`${parent}/photo.png`,`${other}/photo.png`]);
  // Model the Storage API grants so these assertions exercise policies, not missing privileges.
  await db.exec('grant usage on schema storage to anon, authenticated; grant select on storage.objects to anon, authenticated;');
  await asRole(db,'anon',async()=>assert.equal((await db.query("select name from storage.objects where bucket_id='avatars'")).rows.length,0));
  await db.query("select set_config('request.jwt.claim.sub',$1,false)",[parent]);
  await asRole(db,'authenticated',async()=>assert.deepEqual((await db.query("select name from storage.objects where bucket_id='avatars'")).rows,[{name:`${parent}/photo.png`}]))
}}];
