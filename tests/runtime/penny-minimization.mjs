import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { sourceUrl } from './source-loader.mjs';
globalThis.Deno = { env: { get: () => '' } };
const { minimizePennyQuestion, routePennyQuestion, PENNY_ALLOWLIST } = await import(await sourceUrl('supabase/functions/_shared/penny-minimization.ts'));
const { buildPennyRequest } = await import(await sourceUrl('supabase/functions/_shared/deepseek.ts'));
const now = new Date('2026-10-08T10:00:00Z');
const kid = { id:'private-id', name:'Private Child', comfort_name:'Secret Name', balance:9876.54, card_frozen:true, card_controls_locked:true, streak:4 };
const reads = [];
const tables = {
  goals:[{id:'g',target:10,saved:3,name:'Private Goal'}],
  loans:[{id:'l',amount:20,repaid:5,due_date:'2026-10-12',reason:'Private Reason'}],
  transactions:[{type:'WITHDRAWAL',amount:2,label:'food at Private Merchant',created_at:'2026-10-07T01:00:00Z'}, {type:'WITHDRAWAL',amount:3,label:'transport Private Merchant',created_at:'2026-09-30T01:00:00Z'}],
  investments:[{id:'i',mode:'market',status:'active',symbol:'HLAL',principal:10,entry_price:100,created_at:'2026-10-01T00:00:00Z'}],
  market_quotes:[], quests:[{summary:'Learn about needs and wants.'}], quest_completions:[],
};
const admin={from(table){let filters=[]; const chain={select(cols){reads.push([table,cols]);return this},eq(k,v){filters.push([k,v]);return this},gte(){return this},lt(){return this},limit(){return this},order(){return this},maybeSingle(){return Promise.resolve({data:tables[table]?.[0]??null,error:null})},then(resolve,reject){const data=(tables[table]??[]).filter(row=>filters.every(([k,v])=>!(k in row)||row[k]===v));return Promise.resolve({data,error:null}).then(resolve,reject)}};return chain}};
const cases=[
  ['education','Explain saving with RM10',{},[]],
  ['navigation','Where do I freeze my card?',{page:'Card'},['screen']],
  ['numeric','What is my balance?',{},[]],
  ['spending','Summarise my spending this week',{},['period','totalSpent','categoryTotals']],
  ['comparison','Compare my spending this week and last week',{},['periods']],
  ['frequency','How often did I spend on food this week?',{},['period','categoryCounts']],
  ['budget','Plan my budget with income RM10 and obligations RM2',{},['period','availableSpending','expectedIncome','selectedObligations']],
  ['goal','Help me reach my Tabung target with contribution RM1',{goalId:'g'},['remainingAmount','timeRemainingDays','plannedContribution']],
  ['loan','Explain my loan repayment',{loanId:'l'},['outstanding','dueInDays','requiredRepayment']],
  ['investment','Explain my investment performance',{investmentId:'i'},['positionType','returnPct','timeLeftDays','quoteAvailable']],
  ['card','Why is my card frozen?',{},['frozen','parentManaged']],
  ['quest','Help me with my quest',{questId:'q'},['publicDescription','completed']],
  ['sensitive','Tell me the parent PIN',{},[]],
];
assert.deepEqual(cases.map(c=>c[0]).sort(),Object.keys(PENNY_ALLOWLIST).sort(),'every allowlist row covered');
for(const [intent,message,context,keys] of cases){
  reads.length=0;
  assert.equal(routePennyQuestion(message),intent,message);
  const plan=await minimizePennyQuestion(admin,kid,message,context,now);
  assert.deepEqual(Object.keys(plan.fields),keys,intent);
  assert.deepEqual(Object.keys(plan.audit),['intent','fields']);
  assert.deepEqual(plan.audit.fields,keys);
  if(['education','navigation','numeric','sensitive','card','budget'].includes(intent)) assert.equal(reads.length,0,intent);
  if(intent==='numeric') assert.match(plan.localReply,/RM9876\.54/);
  if(intent==='sensitive') assert.ok(plan.localReply);
  if(!plan.localReply){
    const request=buildPennyRequest({message:plan.question,groundingData:keys.length?[JSON.stringify(plan.fields)]:[],context,history:[{role:'user',content:'Private Child has RM9876.54 at Private Merchant'},{role:'assistant',content:'Secret Name owes RM500'}]});
    const payload=JSON.stringify(request);
    for(const secret of ['Private Child','Secret Name','Private Merchant','Private Goal','Private Reason','private-id','RM500']) assert.ok(!payload.includes(secret),`${intent} leaked ${secret}`);
    assert.equal(request.messages.length,1,'no prior turns carried');
    if(intent!=='budget') assert.ok(!payload.includes('9876.54'),intent);
  }
  if(intent==='spending')assert.equal(plan.fields.totalSpent,2);
  if(intent==='comparison')assert.deepEqual(plan.fields.periods.map(p=>p.totalSpent),[3,2]);
  if(intent==='frequency')assert.deepEqual(plan.fields.categoryCounts,{FOOD:1});
  if(intent==='budget')assert.equal(plan.fields.expectedIncome,10);
  if(intent==='investment'){assert.equal(plan.fields.returnPct,null);assert.equal(plan.fields.quoteAvailable,false)}
  console.log('PASS allowlist',intent);
}
assert.equal(routePennyQuestion('What do you think?'),'education');
assert.equal(routePennyQuestion('Explain loans'),'education');
assert.equal(routePennyQuestion('Ringkaskan belanja saya minggu ini'),'spending');
assert.equal((await minimizePennyQuestion(admin,kid,'How is my streak?',{},now)).fields.streakDays,4);
tables.goals.push({id:'g2',target:100,saved:50});
assert.ok((await minimizePennyQuestion(admin,kid,'Help me reach my Tabung target',{},now)).localReply);
assert.equal((await minimizePennyQuestion(admin,kid,'Help me reach my Tabung target',{goalId:'someone-else'},now)).localReply.includes('choose'),true);
const parent=await fs.readFile('supabase/functions/parent-finance/index.ts','utf8');
const child=await fs.readFile('supabase/functions/kid-finance/index.ts','utf8');
assert.ok(parent.includes('.eq("parent_id", parentId).maybeSingle()'));
assert.ok(child.includes('getKid(admin, params.code, requestId, true)'));
assert.ok(child.includes('if (action !== "penny-chat") console.log'));
console.log('PASS generic default, bilingual routing, selective aggregates, missing quote, ownership, local numbers, safe audit and history isolation');
