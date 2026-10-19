import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { chromium } from '@playwright/test';
import { parse } from 'dotenv';
import AxeBuilder from '@axe-core/playwright';
const variant = process.env.CENTSIBILITY_UI_STATE || 'normal';
const labels = process.env.CENTSIBILITY_NESTED_LABELS?.split(',');
import { localPreview } from './local-preview.mjs';
await build({stdin:{contents:'export { getMockEdgeResponse } from \"./src/lib/edge\"; export * from \"./src/lib/demo-data\";',resolveDir:process.cwd(),loader:'ts'},outfile:'analysis/private/reference-ui-integration/ui-fixture-bundle.mjs',bundle:true,packages:'external',platform:'node',format:'esm',define:{'import.meta.env.DEV':'true','import.meta.env':'{}'},alias:{'@':path.resolve('src')}});
const fixtures=await import(pathToFileURL(path.resolve('analysis/private/reference-ui-integration/ui-fixture-bundle.mjs')).href);
const base='http://127.0.0.1:3000';
const stopPreview = await localPreview(base);
const env={...parse(fs.readFileSync('.env')), ...parse(fs.readFileSync('.env.local'))};
const authKey=`sb-${new URL(env.VITE_SUPABASE_URL).hostname.split('.')[0]}-auth-token`;
const user={id:'11111111-1111-4111-8111-111111111111',email:'synthetic@example.invalid',aud:'authenticated',role:'authenticated',app_metadata:{provider:'email'},user_metadata:{display_name:'Synthetic Parent'},created_at:'2026-01-01T00:00:00Z'};
const auth={access_token:'synthetic-access-token',refresh_token:'synthetic-refresh-token',expires_at:Math.floor(Date.now()/1000)+3600,expires_in:3600,token_type:'bearer',user};
const output='test-results/root-reference-ui/nested';fs.mkdirSync(output,{recursive:true});const results=labels && fs.existsSync(output+'/checks.json') ? JSON.parse(fs.readFileSync(output+'/checks.json')).filter(row=>!row.blocked&&!labels.includes(row.label)) : [];const browser=await chromium.launch({channel:'chrome',headless:true});
try {for(const theme of (process.env.CENTSIBILITY_UI_THEMES?.split(',') || ['light','dark']))for(const width of (process.env.CENTSIBILITY_UI_WIDTHS?.split(',').map(Number) || [360,390,768,1024,1440]))for(const audience of (process.env.CENTSIBILITY_UI_AUDIENCES?.split(',') || ['kid','parent','public'])){
  const context=await browser.newContext({viewport:{width,height:900},colorScheme:theme,reducedMotion:'reduce'});
  await context.addInitScript(({audience,theme,authKey,auth})=>{
   localStorage.setItem('centsibility.appearance',theme);sessionStorage.setItem('centsibility.just_unlocked','1');if(audience==='parent')sessionStorage.setItem('parentSessionValidUntil',String(Date.now()+1800000));
   if(audience==='kid') { localStorage.setItem('centsibility.parent.blocked','true');localStorage.setItem('centsibility.kid',JSON.stringify({kidId:'demo-kid-aiman',name:'Synthetic Zoë',code:'a'.repeat(64),expiresAt:Date.now()+86400000})); }
   if(audience==='parent') {localStorage.setItem(authKey,JSON.stringify(auth));localStorage.removeItem('centsibility.parent.blocked');sessionStorage.setItem('centsibility.parent.pinSession',JSON.stringify({token:'synthetic-parent-pin',expiresAt:new Date(Date.now()+1800000).toISOString()}));}
  },{audience,theme,authKey,auth});
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
    if(body.action==='get-state')return reply({...fixtures.DEMO_KID_STATE,kid:{...fixtures.DEMO_KID_STATE.kid,name:'Synthetic Zoë',comfort_name:'Zoë',balance:1234.56}});
    if(body.action==='get-profile')return reply({id:user.id,email:user.email});
    if(body.action==='get-pin')return reply({hasPin:true});
    if(body.action==='get-parent-data')return reply({kids:fixtures.DEMO_KIDS,goals:fixtures.DEMO_GOALS,approvals:fixtures.DEMO_APPROVALS,rewards:fixtures.DEMO_REWARDS,loans:fixtures.DEMO_LOANS,txs:fixtures.DEMO_TRANSACTIONS,notifications:fixtures.DEMO_NOTIFICATIONS,scheduledHibahs:fixtures.DEMO_SCHEDULED_HIBAHS});
    if(body.action==='fund-overview')return reply({available:100,reserved:0,kids:fixtures.DEMO_KIDS.map(k=>({...k,maxTier:'medium'})),requests:[]});
    if(body.action==='get-statement')return reply({...fixtures.getMockEdgeResponse('parent-finance',body),parentName:'Synthetic Parent'});
    return reply(fixtures.getMockEdgeResponse(url.pathname.includes('parent-finance')?'parent-finance':'kid-finance',body));
   }catch{return reply({error:'Synthetic fixture unavailable'},503);}
  });

  const page=await context.newPage();
  const capture=async label=>{
   if(labels && !labels.includes(label)) return;
   const violations=(await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa','wcag22aa']).analyze()).violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}));
   const measure=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,smallButtons:[...document.querySelectorAll('button')].filter(b=>{const r=b.getBoundingClientRect();return r.width>0&&r.height>0&&!b.disabled&&(r.width<47.5||r.height<47.5);}).map(b=>b.getAttribute('aria-label')||b.innerText),reduced:document.documentElement.dataset.motion==='reduced'}));
   await page.screenshot({path:output+'/'+audience+'-'+label+'-'+width+'-'+theme+'.png',fullPage:true});
   results.push({audience,label,width,theme,violations,...measure});
   fs.writeFileSync(output+'/checks.json',JSON.stringify(results,null,2));
  };
  const go=async route=>{await page.goto(base+route,{waitUntil:'networkidle',timeout:90000});await page.evaluate(()=>document.fonts.ready);};
  try{
   if(audience==='kid'){
    if(!labels){
    await go('/kid');await page.getByRole('button',{name:'Account menu',exact:true}).click();await page.getByRole('menuitem',{name:'My profile',exact:true}).click();await page.getByRole('dialog').waitFor();await capture('profile');await page.keyboard.press('Escape');
    await page.evaluate(()=>window.dispatchEvent(new Event('centsibility:open-appearance')));await page.getByRole('dialog').waitFor();await capture('appearance');await page.keyboard.press('Escape');
    await go('/kid/goals');await page.getByRole('button',{name:'Create Tabung',exact:true}).click();await capture('create-tabung');
    await go('/kid/goals');await page.locator('button[aria-controls^="tabung-actions-"]').first().click();await page.getByRole('button',{name:/^Edit /}).first().click();await capture('edit-tabung');
    }
    await go('/kid/wallet');await page.getByRole('tab',{name:'Cash out',exact:true}).click();await capture('request-withdrawal');await page.getByRole('tab',{name:'Borrow',exact:true}).click();await capture('wallet-loan');
    await go('/kid/transfer');await page.locator('.recipient-chip').first().click();await capture('transfer-amount');
    await page.getByLabel('Transfer amount in RM').fill('1.00');await page.getByLabel('Reason or Note (Optional)').fill('Synthetic transfer note');await page.getByRole('button',{name:'Continue',exact:true}).click();await capture('transfer-review');await page.getByRole('button',{name:'Enter PIN to Confirm',exact:true}).click();await capture('transfer-pin');
    if(!labels){
    await go('/kid/loans');await page.getByRole('button',{name:'Ask for a loan',exact:true}).click();await capture('loan-request');
    for(const key of ['1','0','0','0'])await page.getByRole('button',{name:'Key '+key,exact:true}).click();await page.getByRole('button',{name:'Next: add details',exact:true}).click();await page.getByLabel('Reason for loan').fill('Synthetic school supplies');await page.getByLabel('Type your name instead').fill('Synthetic Zoë');await page.getByRole('button',{name:'Use typed signature',exact:true}).focus();await page.keyboard.press('Enter');await page.getByText('Signed',{exact:true}).waitFor();await capture('loan-signature');await page.getByRole('button',{name:'Clear Signature',exact:true}).click();
    const canvas=page.getByLabel('Draw your signature, or type your name below');const box=await canvas.boundingBox();await page.mouse.move(box.x+20,box.y+30);await page.mouse.down();await page.mouse.move(box.x+60,box.y+50,{steps:6});await page.mouse.up();await page.getByText('Signed',{exact:true}).waitFor();await capture('loan-pointer-signature');
    await go('/kid/sadaqah');await page.getByText('Local Masjid',{exact:true}).click();for(const key of ['1','0','0'])await page.getByRole('button',{name:'Key '+key,exact:true}).click();await page.getByRole('button',{name:'Donate Sadaqah',exact:true}).click();await page.getByRole('dialog',{name:'Confirm Sadaqah Donation',exact:true}).waitFor();await capture('sadaqah-confirmation');await page.keyboard.press('Escape');await page.getByRole('tab',{name:'Zakat',exact:true}).click();await capture('zakat');
    await go('/kid/insights');await page.getByRole('button',{name:'Open Daily Wrap',exact:true}).click();await page.getByRole('dialog',{name:'Daily wrap',exact:true}).waitFor();await capture('recap');await page.getByRole('button',{name:'Close story',exact:true}).click();
    await go('/kid/invest');await page.getByRole('button',{name:'Start an investment',exact:true}).click();await page.getByRole('dialog').waitFor();await capture('investment-picker');await page.keyboard.press('Escape');
    await go('/kid/missions');await page.getByRole('tab',{name:/Quests/}).focus();await page.keyboard.press('ArrowRight');await capture('keyboard-rewards-tab');
    }
   }else if(audience==='parent'){
    if(!labels){
    await go('/parent');await page.getByRole('button',{name:'Add child',exact:true}).click();await page.getByRole('dialog').waitFor();await capture('add-child');await page.keyboard.press('Escape');
    await go('/parent');await page.locator('.crew-card__summary').first().click();await capture('expanded-child-controls');
    }
    await go('/parent/settings');for(const name of ['My profile','Children avatars','Dashboard PIN','Sound & appearance','Hibah preferences']){await page.getByRole('button',{name,exact:true}).click();await capture('settings-'+name.replaceAll(' ','-'));}
    await go('/parent/transfer');await page.locator('.recipient-chip').filter({hasText:'Aiman'}).first().click();await capture('parent-transfer-amount');
   }else{
    await go('/');const menu=page.getByRole('button',{name:'Open navigation menu',exact:true});if(await menu.isVisible()){await menu.click();await capture('mobile-menu');}
    await go('/login');await page.keyboard.press('Tab');await capture('sign-in-keyboard');
   }
   if(width===390){await page.evaluate(()=>document.documentElement.style.fontSize='20px');await capture('large-text');}
  }catch(error){results.push({audience,width,theme,blocked:error.message});fs.writeFileSync(output+'/checks.json',JSON.stringify(results,null,2));console.log('BLOCKED '+audience+' '+width+' '+theme+': '+error.message.split('\n')[0]);}
  await page.close();await context.close();
console.log('Checked nested '+audience+' '+width+' '+theme);
}} finally {await browser.close();stopPreview();}
const failures=results.filter(r=>r.blocked||r.overflow||r.violations?.length||r.smallButtons?.length||!r.reduced);
console.log(JSON.stringify({checks:results.length,failures},null,2));
if(failures.length)process.exitCode=1;
