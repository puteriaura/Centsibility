import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { parse } from 'dotenv';
import AxeBuilder from '@axe-core/playwright';
const auditOnly = process.env.CENTSIBILITY_UI_AUDIT === 'true';
const routeFilter = process.env.CENTSIBILITY_UI_ROUTES?.split(',');
const variant = process.env.CENTSIBILITY_UI_STATE || 'normal';
import { localPreview } from './local-preview.mjs';
await build({stdin:{contents:'export { getMockEdgeResponse } from \"./src/lib/edge\"; export * from \"./src/lib/demo-data\";',resolveDir:process.cwd(),loader:'ts'},outfile:`analysis/private/reference-ui-integration/ui-fixture-${variant}.mjs`,bundle:true,packages:'external',platform:'node',format:'esm',define:{'import.meta.env.DEV':'true','import.meta.env':'{}'},alias:{'@':path.resolve('src')}});
const fixtures=await import(pathToFileURL(path.resolve(`analysis/private/reference-ui-integration/ui-fixture-${variant}.mjs`)).href);
const longName = "Synthetic Zoë O'Connell — a deliberately long family account name";
if (variant === 'long') {
  for (const kid of fixtures.DEMO_KIDS) Object.assign(kid, { name: longName, balance: 1234567.89 });
  for (const goal of fixtures.DEMO_GOALS) Object.assign(goal, { name: 'A very long synthetic Tabung goal name for wrapping checks', current: 123456.78, target: 1234567.89 });
}
const base=process.env.CENTSIBILITY_UI_BASE || 'http://127.0.0.1:3000';
const stopPreview = await localPreview(base);
const env={...parse(fs.readFileSync('.env')), ...parse(fs.readFileSync('.env.local'))};
const authKey=`sb-${new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
const user={id:'11111111-1111-4111-8111-111111111111',email:'synthetic@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{display_name:'Synthetic Parent'},created_at:'2026-01-01T00:00:00Z'};
const auth={access_token:'synthetic-access-token',refresh_token:'synthetic-refresh-token',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
const groups={kid:['/kid','/kid/wallet','/kid/transfer','/kid/more','/kid/goals','/kid/missions','/kid/rewards','/kid/quiz','/kid/quest/demo-quest-1','/kid/sadaqah','/kid/zakat','/kid/loans','/kid/card','/kid/history','/kid/insights','/kid/invest','/kid/chat','/kid/notifications'],parent:['/parent','/parent/approvals','/parent/transfer','/parent/insights','/parent/reports','/parent/settings','/parent/penny'],public:['/','/login','/kid-login']};
const output='test-results/root-reference-ui/design';fs.mkdirSync(output,{recursive:true});
const resultPath = `${output}/${auditOnly ? "accessibility" : variant === "normal" ? "matrix" : "matrix-"+variant}.json`;
const results=[];
const browser=await chromium.launch({channel:'chrome',headless:true});
try {
for(const theme of ['light','dark']) for(const width of (auditOnly ? [390] : [360,390,430,768,1440])) {
 for(const [audience,routes] of Object.entries(groups)) {
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});
  await context.addInitScript(({audience,theme,authKey,auth,variant,longName})=>{
   localStorage.setItem('centsibility.appearance',theme);sessionStorage.setItem('centsibility.just_unlocked','1');if(audience==='parent')sessionStorage.setItem('parentSessionValidUntil',String(Date.now()+1800000));
   if(variant==='masked') localStorage.setItem('centsibility.privacy.hidden','true');
   if(variant==='text200') document.addEventListener('DOMContentLoaded',()=>{document.documentElement.style.fontSize='200%';});
   if(audience==='kid') { localStorage.setItem('centsibility.parent.blocked','true');localStorage.setItem('centsibility.kid',JSON.stringify({kidId:'demo-kid-aiman',name:variant==='long'?longName:'Synthetic Zoë',code:'a'.repeat(64),expiresAt:Date.now()+86400000})); }
   if(audience==='parent') {localStorage.setItem(authKey,JSON.stringify(auth));localStorage.removeItem('centsibility.parent.blocked');sessionStorage.setItem('centsibility.parent.pinSession',JSON.stringify({token:'synthetic-parent-pin',expiresAt:new Date(Date.now()+1800000).toISOString()}));}
  },{audience,theme,authKey,auth,variant,longName});
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());if(url.origin===base)return route.continue();
   const reply=(body,status=200)=>route.fulfill({status,headers:{'access-control-allow-origin':'*','access-control-allow-headers':'*'},contentType:'application/json',body:JSON.stringify(body)});
   if(route.request().method()==='OPTIONS')return reply({});
   if(url.pathname.includes('/auth/'))return reply(user);
   if(url.pathname.includes('/rest/v1/')) {
        const table=url.pathname.split('/').at(-1);
        const tables={kids:fixtures.DEMO_KIDS,goals:fixtures.DEMO_GOALS,approvals:fixtures.DEMO_APPROVALS,rewards:fixtures.DEMO_REWARDS,loans:fixtures.DEMO_LOANS,transactions:fixtures.DEMO_TRANSACTIONS,notifications:fixtures.DEMO_NOTIFICATIONS,scheduled_hibahs:fixtures.DEMO_SCHEDULED_HIBAHS,profiles:[{id:user.id,email:user.email}]};
        const state=typeof variant==='undefined'?'normal':variant;
        if(state==='loading') await new Promise(resolve=>setTimeout(resolve,3000));
        if(state==='error') return reply({message:'Synthetic service unavailable'},503);
        return reply(state==='empty'?[]:(tables[table]||[]));
      }
      if(!url.pathname.includes('/functions/')) return route.abort();
   const body=route.request().postDataJSON()??{};
   if(variant==='loading' && ['get-state','get-parent-data','get-statement','get-history','quest-board','invest-list'].includes(body.action)) await new Promise(resolve=>setTimeout(resolve,3000));
   try{
    if(variant==='error' && !['get-profile','get-pin','pin-status','validate-pin-session','verify-pin','revoke-pin-session'].includes(body.action)) return reply({error:'Synthetic service unavailable'},503);
    if(variant==='empty') {
     if(body.action==='get-parent-data') return reply({kids:[],goals:[],approvals:[],rewards:[],loans:[],txs:[],notifications:[],scheduledHibahs:[]});
     if(body.action==='get-state') return reply({...fixtures.DEMO_KID_STATE,kid:{...fixtures.DEMO_KID_STATE.kid,name:'Synthetic Zoë',balance:0,coins:0},goals:[],approvals:[],rewards:[],loans:[],txs:[],notifications:[],investments:[]});
     if(body.action==='get-history') return reply({txs:[]});
     if(body.action==='quest-board') return reply({ageGroup:'10-12',quests:[]});
     if(body.action==='invest-list') return reply({investments:[],requests:[]});
     if(body.action==='transfer-recipients') return reply({parent:null,siblings:[],balance:0,usedToday:0});
    }
    if(body.action==='get-state')return reply({...fixtures.DEMO_KID_STATE,kid:{...fixtures.DEMO_KID_STATE.kid,name:variant==='long'?longName:'Synthetic Zoë',comfort_name:variant==='long'?longName:'Zoë',balance:variant==='long'?1234567.89:1234.56}});
    if(body.action==='get-profile')return reply({id:user.id,email:user.email});
    if(body.action==='get-pin')return reply({hasPin:true});
    if(body.action==='get-parent-data')return reply({kids:fixtures.DEMO_KIDS,goals:fixtures.DEMO_GOALS,approvals:fixtures.DEMO_APPROVALS,rewards:fixtures.DEMO_REWARDS,loans:fixtures.DEMO_LOANS,txs:fixtures.DEMO_TRANSACTIONS,notifications:fixtures.DEMO_NOTIFICATIONS,scheduledHibahs:fixtures.DEMO_SCHEDULED_HIBAHS});
    if(body.action==='fund-overview')return reply({available:100,reserved:0,kids:fixtures.DEMO_KIDS.map(k=>({...k,maxTier:'medium'})),requests:[]});
    if(body.action==='get-statement')return reply({...fixtures.getMockEdgeResponse('parent-finance',body),parentName:'Synthetic Parent'});
    return reply(fixtures.getMockEdgeResponse(url.pathname.includes('parent-finance')?'parent-finance':'kid-finance',body));
   }catch{return reply({error:'Synthetic fixture unavailable'},503);}
  });
  for(const route of routes) {
   if(routeFilter && !routeFilter.includes(route)) continue;
   const page=await context.newPage(), errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.goto(base+route,{waitUntil:variant==='loading'?'domcontentloaded':'networkidle',timeout:60000});
   await page.waitForFunction(()=>Array.from(document.fonts).some(face=>face.family.includes('Red Hat Text')));
   await page.evaluate(async()=>{await document.fonts.load('16px "Red Hat Text"','Simpanan wang café');await document.fonts.ready;});
   if(variant==='loading') {
    if(audience==='public') await page.waitForFunction(()=>document.body.innerText.trim().length>0);
    else await page.locator('.app-shell').waitFor({state:'visible'});
    await page.waitForFunction(()=>Array.from(document.fonts).some(face=>face.family.includes('Red Hat Text')));
    await page.evaluate(()=>document.fonts.load('16px "Red Hat Text"','Simpanan wang café'));
   }
   const measured=await page.evaluate(()=>({docWidth:document.documentElement.scrollWidth,viewport:innerWidth,bodyText:document.body.innerText.slice(0,180),missingNames:[...document.querySelectorAll('button')].filter(b=>!b.innerText.trim()&&!b.getAttribute('aria-label')&&!b.getAttribute('aria-labelledby')).length,fonts:document.fonts.check('16px "Red Hat Text"','Simpanan wang café')}));
   const name=`${variant === "normal" ? "" : variant+"-"}${audience}-${route.replaceAll('/','-').replace(/^-/, '')}-${width}-${theme}`;
   await page.screenshot({path:`${output}/${name}.png`,fullPage:true});
   const violations = auditOnly ? (await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations.map(item=>({id:item.id,impact:item.impact,nodes:item.nodes.map(node=>({target:node.target,summary:node.failureSummary}))})) : [];
   results.push({route,theme,width,violations,overflow:measured.docWidth>width,errors,appError:measured.bodyText.includes("Something went wrong"),missingNames:measured.missingNames,fontsLoaded:measured.fonts});
   await page.close();
  }
  await context.close();
 }
 console.log(`Checked ${theme} ${width}px: ${results.length} route/theme/width states`);
 fs.writeFileSync(`${output}/${auditOnly ? "accessibility" : variant === "normal" ? "matrix" : "matrix-"+variant}.json`,JSON.stringify(results,null,2));
}
} finally {await browser.close();stopPreview();}
const failures=results.filter(r=>r.overflow||r.errors.length||r.appError||r.violations?.length||r.missingNames||!r.fontsLoaded);
console.log(JSON.stringify({checked:results.length,failures},null,2));
if(failures.length)process.exitCode=1;





