import test from 'node:test';import assert from 'node:assert/strict';
import {commerceFixture,exportBody,order,settlement,stock} from './commerce-helpers.mjs';
import {commerceFindings,csvCell,commerceSummaryCsv} from '@runlumi/core/commerce-insights.ts';
import {request} from '../scripts/local-adapters.mjs';
const ok=async(r,status=200)=>{const b=await r.json();assert.equal(r.status,status,JSON.stringify(b));return b;};
async function publish(f,raw=exportBody('orders',[order({cogs:'800000'})]),delivery='first',previous=null){
 const receipt=await f.accept(raw,'orders-export',delivery),build=await ok(await f.normalize(receipt.receiptId));
 const body={normalizationIds:[build.normalizationId],mappingId:null,controls:[],expectedRevision:previous?.revision??0,expectedPublicationId:previous?.publicationId??null};
 const preview=await ok(await f.call('commerce-publications/preview',body));return ok(await f.call('commerce-publications',{...body,previewHash:preview.previewHash,reason:'Review source statement'}),201);
}
async function setup(t){const f=await commerceFixture(t),pub=await publish(f),insights=await ok(await f.call('commerce-insights'));return {...f,pub,finding:insights.findings[0]};}
const decisionBody=f=>({publicationId:f.pub.publicationId,findingId:f.finding.id,rationale:'Verify variable costs and obtain source evidence',dueOn:'2026-09-25'});
const move=(f,d,state,outcome=null)=>f.call('commerce-decisions/'+d.id,{state,note:'Reviewed operational evidence',outcomePublicationId:outcome},{method:'PUT',headers:{'if-match':`"${d.revision}"`}});
async function awaiting(f){const d=await ok(await f.call('commerce-decisions',decisionBody(f)),201);await ok(await move(f,d,'INVESTIGATING'));await ok(await move(f,{...d,revision:2},'AWAITING_OUTCOME'));return {...d,revision:3};}

test('observed findings are deterministic, source-pinned and not causal forecasts',async t=>{
 const f=await setup(t);assert.equal(f.finding.rule,'negative-contribution');assert.equal(f.finding.value,'-160000');
 const a=await ok(await f.call('commerce-insights')),b=await ok(await f.call('commerce-insights'));assert.deepEqual(a,b);assert.equal(a.publicationId,f.pub.publicationId);assert.equal(a.autonomousActionsEnabled,false);
});
test('opening the same finding twice retains one decision and one audit event',async t=>{
 const f=await setup(t),body=decisionBody(f);const [a,b]=await Promise.all([f.call('commerce-decisions',body),f.call('commerce-decisions',body)]);const aa=await ok(a,201),bb=await ok(b,201);assert.equal(aa.id,bb.id);
 const list=await ok(await f.call('commerce-decisions'));assert.equal(list.decisions.length,1);assert.equal(list.decisions[0].owner_subject,'alpha-owner');assert.equal(aa.externalActionExecuted,false);
 assert.equal(f.env.TENANT_A.db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE event_type='commerce.decision-opened'").get().n,1);
});
test('decision rejects fabricated findings, arbitrary assignees and invalid deadlines',async t=>{
 const f=await setup(t);assert.equal((await f.call('commerce-decisions',{...decisionBody(f),findingId:'imagined-loss'})).status,404);
 assert.equal((await f.call('commerce-decisions',{...decisionBody(f),owner:'another-user'})).status,400);
 assert.equal((await f.call('commerce-decisions',{...decisionBody(f),dueOn:'2026-02-30'})).status,400);
});
test('stale evidence cannot open a new decision after publication advances',async t=>{
 const f=await setup(t);await publish(f,exportBody('orders',[order()],{observedAt:'2026-09-19T01:00:00.000Z'}),'corrected',f.pub);
 const r=await f.call('commerce-decisions',decisionBody(f));assert.equal(r.status,409);assert.equal((await r.json()).error.code,'DECISION_REQUIRES_CURRENT_EVIDENCE');
});
test('revision checks prevent lost updates; impossible transitions have no side effect',async t=>{
 const f=await setup(t),d=await ok(await f.call('commerce-decisions',decisionBody(f)),201);
 assert.equal((await move(f,d,'RESOLVED',f.pub.publicationId)).status,409);await ok(await move(f,d,'INVESTIGATING'));assert.equal((await move(f,d,'AWAITING_OUTCOME')).status,409);
 assert.equal((await f.call('commerce-decisions/'+d.id,{state:'AWAITING_OUTCOME',note:'review',outcomePublicationId:null},{method:'PUT'})).status,428);
});
test('resolution requires a new current comparable report with observed improvement, never creates cash recovery',async t=>{
 const f=await setup(t),d=await awaiting(f);
 assert.equal((await move(f,d,'RESOLVED',f.pub.publicationId)).status,409);
 const corrected=await publish(f,exportBody('orders',[order()],{observedAt:'2026-09-19T01:00:00.000Z'}),'corrected',f.pub);
 const result=await ok(await move(f,d,'RESOLVED',corrected.publicationId));assert.equal(result.recordedRecovery,'0');assert.equal(result.externalActionExecuted,false);assert.equal(result.outcomeBasis,'observed-condition-cleared');
 const list=await ok(await f.call('commerce-decisions'));assert.equal(list.decisions[0].outcome_publication_id,corrected.publicationId);
});
for(const mode of ['unchanged-condition','missing-entity','changed-window'])test(`resolution rejects ${mode} rather than manufacturing success`,async t=>{
 const f=await setup(t),d=await awaiting(f);
 const rows=mode==='missing-entity'?[]:[order({cogs:mode==='unchanged-condition'?'800000':'400000'})];
 const raw=exportBody('orders',rows,{observedAt:'2026-09-19T01:00:00.000Z',...(mode==='changed-window'?{window:{from:'2026-09-01T01:00:00.000Z',toExclusive:'2026-09-20T00:00:00.000Z'}}:{})});
 const next=await publish(f,raw,'next',f.pub);const r=await move(f,d,'RESOLVED',next.publicationId);assert.equal(r.status,409);assert.equal((await r.json()).error.code,'OUTCOME_NOT_OBSERVED');
});
test('accepted limitation is not a resolved or recovered outcome',async t=>{
 const f=await setup(t),d=await ok(await f.call('commerce-decisions',decisionBody(f)),201);const r=await ok(await move(f,d,'ACCEPTED_LIMITATION'));assert.equal(r.outcomeBasis,null);assert.equal(r.recordedRecovery,'0');
 assert.equal((await f.call('commerce-decisions',decisionBody(f))).status,409);
});
for(const user of ['alpha-viewer','alpha-editor','beta-owner','platform-admin'])test(`insights, decisions and downloads reject ${user}`,async t=>{
 const f=await setup(t);for(const path of ['commerce-insights','commerce-decisions','commerce-exports/'+f.pub.publicationId])assert.equal((await f.call(path,undefined,{user})).status,403);
 assert.equal((await f.call('commerce-decisions',decisionBody(f),{user})).status,403);
});
test('tenant-qualified IDs prevent cross-tenant evidence and decision access',async t=>{
 const f=await setup(t),d=await ok(await f.call('commerce-decisions',decisionBody(f)),201);
 for(const path of ['commerce-exports/'+f.pub.publicationId,'commerce-decisions/'+d.id]){const method=path.startsWith('commerce-decisions')?'PUT':'GET';const r=await f.api(request('/api/tenants/beta/'+path,{user:'beta-owner',method,...(method==='PUT'?{body:{state:'INVESTIGATING',note:'review',outcomePublicationId:null},headers:{'if-match':'"1"'}}:{})}),f.env);assert.equal(r.status,404);}
});
test('source revocation also removes retained finding and export access',async t=>{
 const f=await setup(t),d=await ok(await f.call('commerce-decisions',decisionBody(f)),201);
 f.env.TENANT_A.db.exec("UPDATE commerce_connections SET state='revoked',revision=revision+1");
 for(const path of ['commerce-insights','commerce-decisions','commerce-exports/'+f.pub.publicationId])assert.equal((await f.call(path)).status,503);
 assert.equal((await move(f,d,'INVESTIGATING')).status,409);
});
test('receipt revocation blocks retained exports as well as reports',async t=>{
 const f=await setup(t);f.env.TENANT_A.db.exec("UPDATE commerce_receipts SET state='REVOKED'");assert.equal((await f.call('commerce-exports/'+f.pub.publicationId)).status,503);
});
test('decision audit failure rolls back the decision mutation',async t=>{
 const f=await setup(t);f.env.TENANT_A.db.exec("CREATE TRIGGER audit_fault BEFORE INSERT ON audit_events WHEN NEW.event_type='commerce.decision-opened' BEGIN SELECT RAISE(ABORT,'fault'); END");
 assert.equal((await f.call('commerce-decisions',decisionBody(f))).status,500);assert.equal(f.env.TENANT_A.db.prepare('SELECT COUNT(*) AS n FROM commerce_decisions').get().n,0);
});
test('private CSV and JSON downloads retain exact snapshot and safe filenames',async t=>{
 const f=await setup(t),r=await f.call('commerce-exports/'+f.pub.publicationId+'?format=csv');assert.equal(r.status,200);assert.match(r.headers.get('cache-control'),/no-store/);assert.match(r.headers.get('content-disposition'),/^attachment; filename="lumi-cp_[a-f0-9]+\.csv"$/);
 const csv=await r.text();assert(csv.includes('"contribution_pre_ads","-160000","VND"'));assert(csv.includes(f.pub.publicationId));assert(csv.includes('PROVISIONAL'));
 const json=await ok(await f.call('commerce-exports/'+f.pub.publicationId+'?format=json'));assert.equal(json.publicationId,f.pub.publicationId);assert.equal(json.report.metrics.contribution_pre_ads,'-160000');
 for(const suffix of ['?format=xlsx','?format=csv&public=true'])assert.equal((await f.call('commerce-exports/'+f.pub.publicationId+suffix)).status,400);
});
test('CSV text cells neutralize formulas while declared numeric values preserve signs',()=>{
 for(const attack of ['=SUM(A1:A2)','+1+2','-2+3','@cmd',' \t=evil','\r=evil'])assert(csvCell(attack).startsWith('"\''));
 assert.equal(csvCell('-160000',true),'"-160000"');assert.equal(csvCell('900719925474099312345',true),'"900719925474099312345"');assert.equal(csvCell('a,"b"'),'"a,""b"""');
});

test('decision transition notes and source approvals retain an immutable audit history',async t=>{
 const f=await setup(t),d=await awaiting(f),detail=await ok(await f.call('commerce-decisions/'+d.id));
 assert.deepEqual(detail.events.map(e=>e.revision),[3,2,1]);assert.equal(detail.events[0].to_state,'AWAITING_OUTCOME');assert.equal(detail.events[2].note,decisionBody(f).rationale);
 assert.throws(()=>f.env.TENANT_A.db.exec("UPDATE commerce_decision_events SET note='rewritten'"),/IMMUTABLE/);
 const r=await f.call('commerce-connections/orders-export',{state:'paused',reason:'Owner revoked testing scope'},{method:'PUT',headers:{'if-match':'"1"'}});assert.equal(r.status,200);
 assert.equal(f.env.TENANT_A.db.prepare('SELECT reason FROM commerce_source_events').get().reason,'Owner revoked testing scope');
 assert.equal((await f.call('commerce-decisions/'+d.id)).status,503);
});

for(const missing of ['cogs','variableFees','shippingIncome','recognition'])test(`missing ${missing} does not resolve a previously negative contribution`,async t=>{
 const f=await setup(t),d=await awaiting(f),changes=missing==='recognition'?{recognizedAt:null,merchandiseReversal:'0',cogs:null,cogsEvidenceRef:null,variableFees:null}:{[missing]:null,...(missing==='cogs'?{cogsEvidenceRef:null}:{})};
 const corrected=await publish(f,exportBody('orders',[order(changes)],{observedAt:'2026-09-19T01:00:00.000Z'}),'unknown-not-resolved',f.pub);
 const r=await move(f,d,'RESOLVED',corrected.publicationId);assert.equal(r.status,409);assert.equal((await r.json()).error.code,'OUTCOME_NOT_OBSERVED');
});
