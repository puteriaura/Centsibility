import fs from 'node:fs';
import assert from 'node:assert/strict';
import { chromium, expect } from '@playwright/test';
import { parse } from 'dotenv';
import ts from 'typescript';
import { localPreview } from './local-preview.mjs';
const base = 'http://127.0.0.1:3000';
const stopPreview = await localPreview(base);
const env = {...parse(fs.readFileSync('.env')), ...parse(fs.readFileSync('.env.local'))};
const host = new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0];
const authKey = `sb-${host}-auth-token`;
const user = { id:'11111111-1111-4111-8111-111111111111', email:'synthetic@example.invalid', aud:'authenticated', role:'authenticated', app_metadata:{provider:'email'}, user_metadata:{display_name:'Synthetic Parent A'}, created_at:'2026-01-01T00:00:00Z' };
const auth = { access_token:'synthetic-access-token', refresh_token:'synthetic-refresh-token', expires_at: Math.floor(Date.now()/1000)+3600, expires_in:3600, token_type:'bearer', user };
const demo = ts.transpileModule(fs.readFileSync('src/lib/demo-data.ts','utf8').replaceAll('import.meta.env.DEV','true'),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const { DEMO_KID_STATE, DEMO_KIDS } = await import('data:text/javascript;base64,'+Buffer.from(demo).toString('base64'));
const browser = await chromium.launch({channel:'chrome', headless:true});
const context = await browser.newContext({viewport:{width:390,height:844}, reducedMotion:'reduce'});
let revoked = false, failStatement = false;
await context.route('**/*', route => {
  const url = new URL(route.request().url());
  if(url.origin === base) return route.continue();
  const reply = (body,status=200) => route.fulfill({status,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},contentType:'application/json',body:JSON.stringify(body)});
  if(route.request().method()==='OPTIONS') return reply({});
  if(url.pathname.includes('/auth/')) return reply(user);
  if(url.pathname.includes('/rest/v1/')) return reply(url.pathname.endsWith('/kids')?DEMO_KIDS:[]);
  if(!url.pathname.includes('/functions/')) return route.abort();
  const body = route.request().postDataJSON() ?? {};
  switch(body.action) {
    case 'get-statement': {
      if (failStatement) return reply({error:'Synthetic statement load failure'},503);
      const statement={kid:{id:body.kidId,name:'Synthetic Child',balance:100},period:{from:body.from,to:body.to},transactions:[{id:'synthetic-deposit',type:'DEPOSIT',amount:10,label:'Synthetic allowance',created_at:body.from+'T01:00:00Z'}]};
      if (body.from==='2026-09-01') return new Promise(resolve=>setTimeout(()=>resolve(reply(statement)),400));
      return reply(statement);
    }
    case 'get-profile':return reply({id:user.id,email:user.email});
    case 'get-pin':return reply({hasPin:true});
    case 'pin-status':return reply({attemptsLeft:5,lockedUntil:null});
    case 'verify-pin':return reply({valid:true,pinSession:'synthetic-parent-pin',pinSessionExpiresAt:new Date(Date.now()+1800000).toISOString()});
    case 'validate-pin-session':return !revoked && body.pinSession==='synthetic-parent-pin' ? reply({valid:true}) : reply({error:'PIN required'},403);
    case 'revoke-pin-session':revoked=true;return reply({ok:true});
    case 'get-parent-data':return reply({kids:DEMO_KIDS,goals:[],approvals:[],rewards:[],loans:[],txs:[],notifications:[],scheduledHibahs:[]});
    case 'kid-investments':return reply({investmentsByKid:{}});
    case 'unread-count':return reply({count:0});
    case 'get-state':return reply(DEMO_KID_STATE);
    case 'invest-list':return reply({investments:[]});
    case 'fund-overview':return reply({available:0,reserved:0,kids:[],requests:[]});
    default:return reply({});
  }
});
fs.mkdirSync('test-results/root-reference-ui/statements',{recursive:true});
await context.addInitScript(()=>{ window.print=()=>{window.__printed=true;}; });
try {
 const page=await context.newPage(); await page.goto(base+'/login');
 await page.evaluate(({authKey,auth})=>{localStorage.setItem(authKey,JSON.stringify(auth));sessionStorage.setItem('centsibility.parent.pinSession',JSON.stringify({token:'synthetic-parent-pin',expiresAt:new Date(Date.now()+1800000).toISOString()}));sessionStorage.setItem('centsibility.just_unlocked','1');sessionStorage.setItem('parentSessionValidUntil',String(Date.now()+1800000));}, {authKey,auth});
 await page.goto(base+'/parent/reports',{waitUntil:'networkidle',timeout:90000});
 const print=page.getByRole('button',{name:'Print / Save PDF',exact:true});
 await expect(print).toBeVisible({timeout:30000});await print.click();await page.waitForFunction(()=>window.__printed===true);
 await page.screenshot({path:'test-results/root-reference-ui/statements/print-ready.png',fullPage:true});
 await page.evaluate(()=>{Object.defineProperty(document,'visibilityState',{value:'hidden',configurable:true});document.dispatchEvent(new Event('visibilitychange'));});
 await expect(page.locator('main')).not.toContainText('RM100.00');
 await page.screenshot({path:'test-results/root-reference-ui/statements/privacy-locked.png',fullPage:true});
 console.log('PASS root statement: synthetic REST reads, existing print action, privacy masking. Root has no direct PDF download/print iframe; those source-only assertions are not claimed.');
} catch (error) {
  const page=context.pages().at(-1);
  if(page){await page.screenshot({path:'test-results/root-reference-ui/statements/failure.png',fullPage:true});console.error((await page.locator('body').innerText()).slice(0,1200));}
  throw error;
} finally {await browser.close();stopPreview();}
