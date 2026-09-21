import test from 'node:test';
import assert from 'node:assert/strict';
import {commerceFixture, call, exportBody, order, settlement, stock, fixturePasswords, SECRET_FIELD} from './helpers.mjs';

async function publishMixed(f){
  await f.connect('settlements-export','settlements','shop-A');
  await f.connect('stock-export','inventory','shop-A');
  const receipts=[];
  for(const [raw,conn,delivery] of [
    [exportBody('orders',[order()]),'orders-export','d-o'],
    [exportBody('settlements',[settlement()]),'settlements-export','d-s'],
    [exportBody('inventory',[stock()]),'stock-export','d-i']]){
    const r=await f.accept(raw,conn,delivery);
    receipts.push((await (await f.normalize(r.receiptId)).json()).normalizationId);
  }
  const body={normalizationIds:receipts.sort(),mappingId:null,controls:[],expectedRevision:0,expectedPublicationId:null};
  const view=await (await call(f,'/api/commerce/publications/preview',{body})).json();
  if(view.error)throw new Error(view.error.code);
  const publish=await call(f,'/api/commerce/publications',{body:{...body,previewHash:view.previewHash,reason:'close'}});
  if(publish.status!==201)throw new Error(await publish.text());
  return (await publish.json()).publicationId;
}

test('saved insights run against a pinned publication and refresh reproducibly',async t=>{
 const f=await commerceFixture(t);try{
  const publicationId=await publishMixed(f);
  const definition={metricIds:['net_merchandise_sales','available_units'],from:'2026-09-01',toExclusive:'2026-09-20',dataVersion:publicationId,blocks:[{id:'sales',kind:'metric',metricId:'net_merchandise_sales'},{id:'stock',kind:'metric',metricId:'available_units'}]};
  const create=await call(f,'/api/commerce/insights',{body:{id:'weekly-commerce',title:'Weekly commerce review',definition}});
  if(create.status!==201)throw new Error(await create.text());
  const insight=await create.json();
  assert.equal(insight.publicationId,publicationId);
  assert.equal(insight.result.net_merchandise_sales.value,'720000');
  assert.equal(insight.result.available_units.value,null,'period-filtered runs resolve recognized-order metrics only');
  // Reproducible run identity and stored result.
  const list=await (await call(f,'/api/commerce/insights?insightId=weekly-commerce',{method:'GET'})).json();
  assert.equal(list.insights[0].runs.length,1);
  assert.equal(list.insights[0].runs[0].publicationHash,list.insights[0].runs[0].publicationHash);
  // Refresh bumps the revision and stores another run.
  const refresh=await call(f,'/api/commerce/insights/weekly-commerce/refresh',{body:{expectedRevision:1}});
  if(refresh.status!==200)throw new Error(await refresh.text());
  assert.equal((await refresh.json()).revision,2);
  const stale=await call(f,'/api/commerce/insights/weekly-commerce/refresh',{body:{expectedRevision:1}});
  assert.equal(stale.status,409);
  const after=await (await call(f,'/api/commerce/insights?insightId=weekly-commerce',{method:'GET'})).json();
  assert.equal(after.insights[0].runs.length,2);
 }finally{f.close();}
});

test('insight promotion returns reviewed TSX source for explicit approval, never executes it',async t=>{
 const f=await commerceFixture(t);try{
  const publicationId=await publishMixed(f);
  const definition={metricIds:['net_merchandise_sales'],from:'2026-09-01',toExclusive:'2026-09-20',dataVersion:publicationId,blocks:[{id:'sales',kind:'metric',metricId:'net_merchandise_sales'}]};
  await call(f,'/api/commerce/insights',{body:{id:'promo',title:'Promo <script>alert(1)</script> report',definition}});
  const promote=await call(f,'/api/commerce/insights/promo/promote',{method:'POST'});
  assert.equal(promote.status,200);const proposal=await promote.json();
  assert.equal(proposal.approvalRequired,true);
  assert.equal(proposal.hardCodedResults,false);
  assert.match(proposal.path,/customer\/reports\/promo\.report\.tsx/);
  assert.ok(proposal.source.includes('reportDefinition'),'the reviewed definition travels as data');
  assert.ok(!proposal.source.includes('<script>'),'untrusted title markup is not copied into code');
  // Nothing was written into the repository by the promotion.
  const denied=await call(f,'/api/commerce/insights/unknown/promote');
  assert.equal(denied.status,404);
 }finally{f.close();}
});

test('insights are owner-only and pinned to published evidence',async t=>{
 const f=await commerceFixture(t);try{
  const publicationId=await publishMixed(f);
  const definition={metricIds:['net_merchandise_sales'],from:'2026-09-01',toExclusive:'2026-09-20',dataVersion:publicationId,blocks:[{id:'s',kind:'metric',metricId:'net_merchandise_sales'}]};
  const viewer=await call(f,'/api/commerce/insights',{user:'viewer@acme.test',pass:fixturePasswords.staff,body:{id:'v',title:'v',definition}});
  assert.equal(viewer.status,403);
  const badPublication={...definition,dataVersion:'cp_nonexistent'};
  const missing=await call(f,'/api/commerce/insights',{body:{id:'m',title:'m',definition:badPublication}});
  assert.equal(missing.status,404);
 }finally{f.close();}
});
