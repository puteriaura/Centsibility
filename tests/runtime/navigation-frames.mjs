import {localPreview} from './local-preview.mjs';
import {chromium,expect} from '@playwright/test';import fs from 'node:fs';import path from 'node:path';
const base=process.env.CENTSIBILITY_UI_BASE||'http://127.0.0.1:4380';
process.env.VITE_SUPABASE_URL ||= 'http://127.0.0.1:9';process.env.VITE_SUPABASE_ANON_KEY ||= ['local','synthetic','only'].join('-');
const stop=await localPreview(base);
const phase=process.argv[2]||'after';const output=path.resolve(process.env.CENTSIBILITY_NAV_OUTPUT||'test-results/navigation-frames-'+phase);fs.mkdirSync(output,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const results=[];
try{for(const [name,from,to,link] of [['tab','/kid/wallet','/kid/insights','Insights'],['drill','/kid','/kid/goals','Tabung']]){
 const context=await browser.newContext({viewport:{width:390,height:844},recordVideo:{dir:output,size:{width:390,height:844}}});await context.route('**/*',r=>r.request().url().startsWith(base+'/')?r.continue():r.abort());
 await context.addInitScript(()=>{sessionStorage.setItem('centsibility:admin-bypass-kid','true');sessionStorage.setItem('centsibility:admin-bypass-parent','true');sessionStorage.setItem('centsibility.just_unlocked','1');localStorage.setItem('centsibility.appearance','light');localStorage.setItem('centsibility.welcome.demo-kid-aiman',new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kuala_Lumpur'}).format(new Date()));localStorage.setItem('centsibility.kid',JSON.stringify({kidId:'demo-kid-aiman',name:'Demo',code:''}));
  const sample=()=>{const main=document.querySelector('.app-shell__main');const body=main?.querySelector('.deposit-account-stack')?'Wallet':main?.querySelector('.home-balance')?'Home':main?.querySelector('.insights-page')?'Insights':main?.querySelector('[aria-label="Tabung summary"]')?'Tabung':main?.querySelector('.ui-skeleton')?'Skeleton':'Empty';return{time:performance.now(),title:document.querySelector('.shell-topbar__title')?.textContent||'Home',body}};
  window.navigationTrace={events:[],frames:[],active:false};const original=document.startViewTransition.bind(document);document.startViewTransition=(...args)=>{const trace=window.navigationTrace;const event={before:sample(),types:args[0]?.types||[]};if(trace.active)trace.events.push(event);const result=original(...args);result.updateCallbackDone.then(()=>event.after=sample());return result};
  const frame=()=>{if(window.navigationTrace.active)window.navigationTrace.frames.push(sample());requestAnimationFrame(frame)};requestAnimationFrame(frame);
 });
 const pageCreated=Date.now();const page=await context.newPage();await page.goto(base+from);await page.getByText(from==='/kid'?'My balance':'Spending',{exact:true}).first().waitFor();await page.waitForTimeout(1600);
 const clickOffset=(Date.now()-pageCreated)/1000;const started=await page.evaluate(()=>{window.navigationTrace.active=true;return performance.now()});const video=page.video();const videoPath=await video.path();
 if(name==='tab')await page.locator('.shell-bottomnav').getByRole('link',{name:link,exact:true}).click();else await page.getByRole('link',{name:link,exact:true}).click();
 await expect(page).toHaveURL(new RegExp(to+'/?$'));await page.waitForTimeout(1700);const trace=await page.evaluate(()=>{window.navigationTrace.active=false;return window.navigationTrace});
 const mismatches=trace.frames.filter(f=>f.body!=='Skeleton'&&f.body!=='Empty'&&f.title!==f.body);
 const snapshotsPaired=trace.events.every(e=>e.before.title===e.before.body&&e.after?.title===link&&['Skeleton',link].includes(e.after?.body));
 const result={name,started,clickOffset,snapshotsPaired,video:path.basename(videoPath),trace,mismatches,transitionCount:trace.events.length,passed:mismatches.length===0&&trace.events.length===1&&snapshotsPaired};results.push(result);await context.close();
 fs.renameSync(videoPath,path.join(output,name+'.webm'));
}
 fs.writeFileSync(path.join(output,'timing.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results.map(({name,transitionCount,mismatches,passed})=>({name,transitionCount,mismatchedFrames:mismatches.length,passed}))));
 if(phase==='after'&&results.some(r=>!r.passed))process.exitCode=1;
}finally{await browser.close();stop()}
