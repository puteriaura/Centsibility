import fs from 'node:fs';
import assert from 'node:assert/strict';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium,expect} from '@playwright/test';
import {parse} from 'dotenv';
import {build} from 'esbuild';
import {localPreview} from './local-preview.mjs';
const base='http://127.0.0.1:3000', stop=await localPreview(base);
await build({stdin:{contents:'export {getMockEdgeResponse} from "./src/lib/edge"; export * from "./src/lib/demo-data";',resolveDir:process.cwd(),loader:'ts'},outfile:'analysis/private/reference-ui-integration/boundary-fixtures.mjs',bundle:true,packages:'external',platform:'node',format:'esm',define:{'import.meta.env.DEV':'true','import.meta.env':'{}'},alias:{'@':path.resolve('src')}});
const fixtures=await import(pathToFileURL(path.resolve('analysis/private/reference-ui-integration/boundary-fixtures.mjs')));
const env={...parse(fs.readFileSync('.env')),...parse(fs.readFileSync('.env.local'))};
const authKey=`sb-${new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
const output='test-results/root-reference-ui/boundaries';fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});
const user={id:'11111111-1111-4111-8111-111111111111',email:'synthetic@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{display_name:'Synthetic Parent'},created_at:'2026-01-01T00:00:00Z'};
const rows={A:{id:'synthetic-row-A',code:'a'.repeat(64),revoked_at:null},B:{id:'synthetic-row-B',code:'b'.repeat(64),revoked_at:null}};
const requests=[];const errors=[];let parentPinExpired=false;
const auth={access_token:'synthetic-access-token',refresh_token:'synthetic-refresh-token',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
async function contextFor(kind){
 const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'});
 await context.addInitScript(({kind,auth,authKey,code})=>{
  sessionStorage.setItem('centsibility.just_unlocked','1');
  if(kind==='A'||kind==='B')localStorage.setItem('centsibility.kid',JSON.stringify({kidId:'demo-kid-aiman',name:'Synthetic Child',code,expiresAt:Date.now()+86400000}));
  else if(kind!=='signed-out'){
   localStorage.setItem(authKey,JSON.stringify(auth));
   sessionStorage.setItem('parentSessionValidUntil',String(Date.now()+1800000));
   sessionStorage.setItem('centsibility.parent.pinSession',JSON.stringify({token:'synthetic-parent-pin',expiresAt:new Date(Date.now()+1800000).toISOString()}));
  }
 },{kind,auth,authKey,code:rows[kind]?.code});
 await context.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.origin===base)return route.continue();
  const reply=(data,status=200)=>route.fulfill({status,contentType:'application/json',headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},body:JSON.stringify(data)});
  if(route.request().method()==='OPTIONS')return reply({});
  if(url.pathname.includes('/auth/')){if(kind==='loading')await new Promise(r=>setTimeout(r,1500));return reply(user);}
  if(url.pathname.includes('/rest/v1/')){requests.push({kind,action:'rest:'+url.pathname.split('/').at(-1)});return reply(url.pathname.endsWith('/kids')?fixtures.DEMO_KIDS:[]);}
  if(!url.pathname.includes('/functions/'))return route.abort();
  const body=route.request().postDataJSON()||{};requests.push({kind,action:body.action});
  if(url.pathname.includes('kid-finance')){
   const row=Object.values(rows).find(row=>row.code===body.code);
   if(row?.revoked_at)return reply({error:'You were signed out. Please sign in again.',code:'session_invalid'},401);
   if(body.action==='logout'){assert(row);row.revoked_at=new Date().toISOString();return reply({ok:true});}
  }
  if(body.action==='get-profile'){if(kind==='loading')await new Promise(r=>setTimeout(r,1800));return reply({id:user.id,email:user.email});}
  if(parentPinExpired&&kind==='parent')return reply({error:'PIN required'},403);
  if(body.action==='get-pin')return reply({hasPin:true});
  return reply(fixtures.getMockEdgeResponse(url.pathname.includes('parent-finance')?'parent-finance':'kid-finance',body));
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 return {context,page};
}
try{
 const A=await contextFor('A'),B=await contextFor('B');
 await A.page.goto(base+'/kid/more',{waitUntil:'networkidle',timeout:90000});await B.page.goto(base+'/kid',{waitUntil:'networkidle',timeout:90000});
 await A.page.getByRole('link',{name:'Tabung',exact:true}).click();await expect(A.page).toHaveURL(/kid\/goals/);await A.page.goBack({waitUntil:'networkidle'});await expect(A.page).toHaveURL(/kid\/more/);
 await A.page.getByRole('button',{name:'Sign out',exact:true}).click();await expect(A.page).toHaveURL(/kid-login/);
 assert(rows.A.revoked_at);assert.equal(rows.B.revoked_at,null);
 await B.page.reload({waitUntil:'networkidle'});await expect(B.page.locator('.app-shell')).toBeVisible();
 // Synthetic server revocation models the existing session_invalid response contract;
 // Deno fake-admin tests separately verify which persisted rows logout/reset target.
 rows.B.revoked_at=new Date().toISOString();await B.page.reload({waitUntil:'networkidle'});await expect(B.page).toHaveURL(/kid-login/);
 await B.page.screenshot({path:output+'/revoked-child.png'});
 const parent=await contextFor('parent');await parent.page.goto(base+'/parent/settings',{waitUntil:'networkidle',timeout:90000});
 await expect(parent.page.getByRole('button',{name:'My profile',exact:true})).toBeVisible();
 await parent.page.screenshot({path:output+'/signed-in-parent.png',fullPage:true});
 parentPinExpired=true;await parent.page.goto(base+'/parent/settings',{waitUntil:'networkidle',timeout:90000});await expect(parent.page.locator('.pin-screen')).toBeVisible();await expect(parent.page.locator('.app-shell')).toHaveCount(0);
 const signedOut=await contextFor('signed-out');await signedOut.page.goto(base+'/parent',{waitUntil:'networkidle',timeout:90000});await expect(signedOut.page.getByRole('heading',{name:'Children',exact:true})).toBeVisible();assert.equal(requests.filter(r=>r.kind==='signed-out').length,0);await expect(signedOut.page.locator('.app-shell')).toHaveCount(0);
 const loading=await contextFor('loading');await loading.page.goto(base+'/parent',{waitUntil:'domcontentloaded',timeout:90000});await expect(loading.page.getByText('Loading…',{exact:true})).toBeVisible();await expect(loading.page.locator('.app-shell')).toBeVisible();
 assert.deepEqual(errors,[]);
 const evidence={status:'PASS',browserBack:'PASS',specificRows:Object.values(rows).map(({id,revoked_at})=>({id,revoked_at})),logoutCalls:requests.filter(r=>r.action==='logout').length,parentBranches:['loading','signed-out','signed-in','expired-PIN'],scope:'Synthetic interceptors only; no production sessions queried or changed.'};
 assert.equal(evidence.logoutCalls,1);fs.writeFileSync(output+'/verification.json',JSON.stringify(evidence,null,2));console.log(JSON.stringify(evidence));
 await Promise.all([A.context.close(),B.context.close(),parent.context.close(),signedOut.context.close(),loading.context.close()]);
}finally{await browser.close();stop();}
