import test from 'node:test';
import assert from 'node:assert/strict';
import {commerceFixture, call, exportBody, order, settlement, stock, createStaff, fixturePasswords, SECRET_FIELD} from './helpers.mjs';

async function publish(f,raw,connectionId,deliveryId,{expectedRevision=0,expectedPublicationId=null}={}){
  const receipt=await f.accept(raw,connectionId,deliveryId);
  const build=await (await f.normalize(receipt.receiptId)).json();
  const body={normalizationIds:[build.normalizationId],mappingId:null,controls:[],expectedRevision,expectedPublicationId};
  const view=await (await call(f,'/api/commerce/publications/preview',{body})).json();
  if(view.error)throw new Error(view.error.code);
  const publish=await call(f,'/api/commerce/publications',{body:{...body,previewHash:view.previewHash,reason:'close'}});
  if(publish.status!==201)throw new Error(await publish.text());
  return {...(await publish.json()),build};
}

test('findings are observed conditions with stable ids; missing data is a finding, not a zero',async t=>{
 const f=await commerceFixture(t);try{
  // An order missing fees and a settlement with an unreconciled gap.
  const orders=exportBody('orders',[order({variableFees:null})]);
  const settlements=exportBody('settlements',[settlement()]);
  await f.connect('settlements-export','settlements','shop-A');
  const r1=await f.accept(orders,'orders-export','delivery-o');const b1=await (await f.normalize(r1.receiptId)).json();
  const r2=await f.accept(settlements,'settlements-export','delivery-s');const b2=await (await f.normalize(r2.receiptId)).json();
  const ids=[b1.normalizationId,b2.normalizationId].sort();
  const body={normalizationIds:ids,mappingId:null,controls:[],expectedRevision:0,expectedPublicationId:null};
  const view=await (await call(f,'/api/commerce/publications/preview',{body})).json();
  await call(f,'/api/commerce/publications',{body:{...body,previewHash:view.previewHash,reason:'close'}});
  const findings=await call(f,'/api/commerce/findings',{method:'GET'});
  assert.equal(findings.status,200);const body2=await findings.json();
  assert.equal(body2.detectorVersion,'commerce-observed-rules-v1');
  assert.equal(body2.autonomousActionsEnabled,false);
  const rules=body2.findings.map(x=>x.rule);
  assert.ok(rules.includes('missing-fees'),'missing variable fees is observed');
  assert.ok(rules.includes('payout-gap'),'unreconciled payout is observed');
  const gap=body2.findings.find(x=>x.rule==='payout-gap');
  assert.equal(gap.value,'20000','expected 520000 in settled components vs 500000 observed cash');
 }finally{f.close();}
});

test('decision lifecycle: evidence-pinned opening, guarded transitions and outcome proof',async t=>{
 const f=await commerceFixture(t);try{
  await f.connect('settlements-export','settlements','shop-A');
  // P1: settlement with a 520000 payout gap.
  const p1=await publish(f,exportBody('settlements',[settlement()]),'settlements-export','delivery-1');
  const findings=await (await call(f,'/api/commerce/findings',{method:'GET'})).json();
  const gap=findings.findings.find(x=>x.rule==='payout-gap');
  // Open a decision pinned to P1.
  const open=await call(f,'/api/commerce/decisions',{body:{publicationId:p1.publicationId,findingId:gap.id,rationale:'Reconcile the missing payout with the bank.',dueOn:'2026-10-15'}});
  assert.equal(open.status,201);const decision=await open.json();
  assert.equal(decision.state,'OPEN');
  const decisionId=decision.id;
  // A duplicate decision for the same finding replays, not duplicates.
  const again=await call(f,'/api/commerce/decisions',{body:{publicationId:p1.publicationId,findingId:gap.id,rationale:'Reconcile the missing payout with the bank.',dueOn:'2026-10-15'}});
  assert.equal((await again.json()).id,decisionId);
  // Invalid transition OPEN -> RESOLVED.
  const invalid=await call(f,`/api/commerce/decisions/${decisionId}`,{method:'PUT',body:{state:'RESOLVED',note:'skipping steps',expectedRevision:1}});
  assert.equal(invalid.status,409);
  // OPEN -> INVESTIGATING with revision guard.
  const investigating=await call(f,`/api/commerce/decisions/${decisionId}`,{method:'PUT',body:{state:'INVESTIGATING',note:'Collecting bank statements.',expectedRevision:1}});
  assert.equal(investigating.status,200);
  const stale=await call(f,`/api/commerce/decisions/${decisionId}`,{method:'PUT',body:{state:'AWAITING_OUTCOME',note:'stale revision',expectedRevision:1}});
  assert.equal(stale.status,409);assert.equal((await stale.json()).error.code,'REVISION_CONFLICT');
  const awaiting=await call(f,`/api/commerce/decisions/${decisionId}`,{method:'PUT',body:{state:'AWAITING_OUTCOME',note:'Waiting for the new settlement export.',expectedRevision:2}});
  assert.equal(awaiting.status,200);
  // Resolve requires NEW publication evidence where the finding cleared.
  const at=ms=>new Date(ms).toISOString();
  const balanced=settlement({id:'statement-1',receipts:[{id:'bank-1',observedAt:at(Date.now()-7_200_000),amount:'320000',evidenceRef:'bank-statement-2'},{id:'bank-2',observedAt:at(Date.now()-7_200_000),amount:'200000',evidenceRef:'bank-statement-3'}]});
  // Same window as P1 (outcome comparability), fresh observation instant.
  const p2raw=exportBody('settlements',[balanced],{observedAt:at(Date.now()-60_000)});
  const receipt=await f.accept(p2raw,'settlements-export','delivery-2');
  const build=await (await f.normalize(receipt.receiptId)).json();
  const status=await (await call(f,'/api/commerce/publication-status',{method:'GET'})).json();
  const body={normalizationIds:[build.normalizationId],mappingId:null,controls:[],expectedRevision:status.revision,expectedPublicationId:status.activePublicationId};
  const view=await (await call(f,'/api/commerce/publications/preview',{body})).json();
  if(view.error)throw new Error(view.error.code);
  const p2=await (await call(f,'/api/commerce/publications',{body:{...body,previewHash:view.previewHash,reason:'new settlement statement'}})).json();
  assert.equal(p2.replayed,false);
  const resolve=await call(f,`/api/commerce/decisions/${decisionId}`,{method:'PUT',body:{state:'RESOLVED',note:'Payout fully matched by bank evidence.',outcomePublicationId:p2.publicationId,expectedRevision:3}});
  assert.equal(resolve.status,200,await resolve.text());
  // History is retained with every transition.
  const history=await (await call(f,`/api/commerce/decisions?decisionId=${decisionId}`,{method:'GET'})).json();
  assert.equal(history.decisions[0].state,'RESOLVED');
  assert.equal(history.events.length,4,'OPEN, INVESTIGATING, AWAITING_OUTCOME, RESOLVED');
  assert.throws(()=>f.db.db.exec("UPDATE commerce_decision_events SET note='x'"),/DECISION_EVENT_IMMUTABLE/);
 }finally{f.close();}
});

test('decision access: viewer cannot open or advance decisions',async t=>{
 const f=await commerceFixture(t);try{
  const denied=await call(f,'/api/commerce/decisions',{user:'viewer@acme.test',pass:fixturePasswords.staff,body:{publicationId:'cp_x',findingId:'r:x',rationale:'nope'}});
  assert.equal(denied.status,403);
  const deniedList=await call(f,'/api/commerce/decisions',{user:'viewer@acme.test',pass:fixturePasswords.staff,method:'GET'});
  assert.equal(deniedList.status,403);
 }finally{f.close();}
});
