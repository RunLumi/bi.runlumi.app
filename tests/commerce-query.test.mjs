import test from 'node:test';
import assert from 'node:assert/strict';
import {commerceFixture,call,exportBody,order,stock,settlement} from './helpers.mjs';

async function publishMixed(f){
  await f.connect('stock-export','inventory','shop-A');
  const ordersReceipt=await f.accept(exportBody('orders',[order(),order({id:'9007199254740994',recognizedAt:null,merchandiseReversal:'0',cogs:null,cogsEvidenceRef:null,variableFees:null})]),'orders-export','delivery-orders');
  const ordersBuild=await (await f.normalize(ordersReceipt.receiptId)).json();
  const stockReceipt=await f.accept(exportBody('inventory',[stock()]),'stock-export','delivery-stock');
  const stockBuild=await (await f.normalize(stockReceipt.receiptId)).json();
  const body={normalizationIds:[ordersBuild.normalizationId,stockBuild.normalizationId].sort(),mappingId:null,controls:[],expectedRevision:0,expectedPublicationId:null};
  const view=await (await call(f,'/api/commerce/publications/preview',{body})).json();
  const publish=await call(f,'/api/commerce/publications',{body:{...body,previewHash:view.previewHash,reason:'close'}});
  if(publish.status!==201)throw new Error(await publish.text());
  const published=await publish.json();
  return published;
}

test('commerce metric catalog is typed, versioned and role-scoped',async t=>{
 const f=await commerceFixture(t);try{
  const catalog=await call(f,'/api/commerce/metrics',{method:'GET'});
  assert.equal(catalog.status,200);const body=await catalog.json();
  const ids=body.metrics.map(m=>m.id);
  for(const required of ['net_merchandise_sales','recognized_order_count','cogs','gross_profit','contribution_pre_ads','expected_settlement','observed_cash_received','unreconciled_payout_amount','available_units'])assert.ok(ids.includes(required),required);
  assert.ok(body.metrics.every(m=>m.version===1));
 }finally{f.close();}
});

test('published-only query resolves typed values over the pinned publication',async t=>{
 const f=await commerceFixture(t);try{
  const published=await publishMixed(f);
  const query=await call(f,'/api/commerce/queries',{body:{contract:'lumi.query.v1',metrics:[{id:'net_merchandise_sales',version:1},{id:'available_units',version:1},{id:'physical_pool_variant_count',version:1}],dimensions:[],filters:[],limit:10,consistency:'published',dataVersion:published.publicationId}});
  if(query.status!==200)throw new Error(await query.text());
  const body=await query.json();
  assert.equal(body.publicationId,published.publicationId);
  assert.equal(body.result.metrics.net_merchandise_sales.value,'720000');
  assert.equal(body.result.metrics.available_units.value,'10');
  assert.equal(body.result.metrics.physical_pool_variant_count.value,'1');
  assert.equal(body.result.coverage,'unfiltered');
  // An unknown metric fails with a stable code.
  const unknown=await call(f,'/api/commerce/queries',{body:{contract:'lumi.query.v1',metrics:[{id:'not_a_metric',version:1}],dimensions:[],filters:[],limit:10,consistency:'published',dataVersion:published.publicationId}});
  assert.equal(unknown.status,400);assert.equal((await unknown.json()).error.code,'UNKNOWN_COMMERCE_METRIC');
  // Consistency must be published.
  const draft=await call(f,'/api/commerce/queries',{body:{contract:'lumi.query.v1',metrics:[{id:'net_merchandise_sales',version:1}],dimensions:[],filters:[],limit:10,consistency:'live',dataVersion:published.publicationId}});
  assert.equal(draft.status,400);assert.equal((await draft.json()).error.code,'COMMERCE_CONSISTENCY_REQUIRED');
 }finally{f.close();}
});

test('recognized cohort semantics: unrecognized orders never enter sales; missing components yield nulls',async t=>{
 const f=await commerceFixture(t);try{
  const published=await publishMixed(f);
  const query=await call(f,'/api/commerce/queries',{body:{contract:'lumi.query.v1',metrics:[{id:'recognized_order_count',version:1},{id:'cogs',version:1},{id:'gross_profit',version:1},{id:'contribution_pre_ads',version:1}],dimensions:[],filters:[],limit:10,consistency:'published',dataVersion:published.publicationId}});
  const body=await query.json();
  assert.equal(body.result.metrics.recognized_order_count.value,'1','only the recognized order counts');
  assert.equal(body.result.metrics.cogs.value,'400000','unrecognized orders contribute nothing');
  assert.equal(body.result.metrics.gross_profit.value,'320000');
  assert.equal(body.result.metrics.contribution_pre_ads.value,'240000','recognized order has complete cost coverage');
 }finally{f.close();}
});

test('source dimension requires reviewed identity links across multiple sources',async t=>{
 const f=await commerceFixture(t);try{
  // Two orders sources for the same window without a mapping.
  const a=await f.accept(exportBody('orders'),'orders-export','delivery-a');
  const buildA=await (await f.normalize(a.receiptId)).json();
  await f.connect('orders-export-2','orders','shop-B');
  const b=await f.accept(exportBody('orders',null,{sourceAccountId:'shop-B'}),'orders-export-2','delivery-b');
  const buildB=await (await f.normalize(b.receiptId)).json();
  const body={normalizationIds:[buildA.normalizationId,buildB.normalizationId].sort(),mappingId:null,controls:[],expectedRevision:0,expectedPublicationId:null};
  const preview=await call(f,'/api/commerce/publications/preview',{body});
  assert.equal(preview.status,422);assert.equal((await preview.json()).error.code,'CROSS_SOURCE_IDENTITY_REVIEW_REQUIRED');
 }finally{f.close();}
});

test('viewer is denied sensitive metrics; sales/stock queries still work',async t=>{
 const f=await commerceFixture(t);try{
  await f.connect('stock-export','inventory','shop-A');
  const ordersReceipt=await f.accept(exportBody('orders',[order()]),'orders-export','d-o');
  const ordersBuild=await (await f.normalize(ordersReceipt.receiptId)).json();
  const stockReceipt=await f.accept(exportBody('inventory',[stock()]),'stock-export','d-i');
  const stockBuild=await (await f.normalize(stockReceipt.receiptId)).json();
  const body={normalizationIds:[ordersBuild.normalizationId,stockBuild.normalizationId].sort(),mappingId:null,controls:[],expectedRevision:0,expectedPublicationId:null};
  const view=await (await call(f,'/api/commerce/publications/preview',{body})).json();
  const publish=await call(f,'/api/commerce/publications',{body:{...body,previewHash:view.previewHash,reason:'close'}});
  const pid=(await publish.json()).publicationId;
  const run=(user,metrics)=>call(f,'/api/commerce/queries',{user,pass:'staff-password-1',body:{contract:'lumi.query.v1',metrics:metrics.map(id=>({id,version:1})),dimensions:[],filters:[],limit:10,consistency:'published',dataVersion:pid}});
  const denied=await run('viewer@acme.test',['cogs']);
  assert.equal(denied.status,403);assert.equal((await denied.json()).error.code,'COMMERCE_FIELD_DENIED');
  const deniedMixed=await run('viewer@acme.test',['net_merchandise_sales','gross_profit']);
  assert.equal(deniedMixed.status,403,'a mixed request must not leak the allowed subset');
  const allowed=await run('viewer@acme.test',['net_merchandise_sales','recognized_order_count','available_units']);
  assert.equal(allowed.status,200);
  assert.equal((await allowed.json()).result.metrics.net_merchandise_sales.value,'720000');
  const editorCogs=await run('editor@acme.test',['cogs']);
  assert.equal(editorCogs.status,403,'editors are not exempt from field scope');
  // The viewer-facing catalog hides sensitive metrics entirely.
  const catalog=await call(f,'/api/commerce/metrics',{user:'viewer@acme.test',pass:'staff-password-1',method:'GET'});
  const ids=(await catalog.json()).metrics.map((m)=>m.id);
  assert.equal(ids.includes('cogs'),false,'sensitive metrics must be absent from the viewer catalog');
  assert.ok(ids.includes('net_merchandise_sales'));
 }finally{f.close();}
});

test('known cost stays known under a valid filter; grain-unfilterable metrics say so; out-of-window never fakes zeros',async t=>{
 const f=await commerceFixture(t);try{
  await f.connect('stock-export','inventory','shop-A');
  const ordersReceipt=await f.accept(exportBody('orders',[order()]),'orders-export','d-o');
  const ordersBuild=await (await f.normalize(ordersReceipt.receiptId)).json();
  const stockReceipt=await f.accept(exportBody('inventory',[stock()]),'stock-export','d-i');
  const stockBuild=await (await f.normalize(stockReceipt.receiptId)).json();
  const body={normalizationIds:[ordersBuild.normalizationId,stockBuild.normalizationId].sort(),mappingId:null,controls:[],expectedRevision:0,expectedPublicationId:null};
  const view=await (await call(f,'/api/commerce/publications/preview',{body})).json();
  const pid=(await (await call(f,'/api/commerce/publications',{body:{...body,previewHash:view.previewHash,reason:'close'}})).json()).publicationId;
  const run=(filters,metrics)=>call(f,'/api/commerce/queries',{body:{contract:'lumi.query.v1',metrics:metrics.map(id=>({id,version:1})),dimensions:[],filters,limit:10,consistency:'published',dataVersion:pid}});
  // Recognition business-day 2026-09-03 (recognizedAt 2026-09-03T00:00Z) — a
  // full-day UTC+7 window covering it: [2026-09-03, 2026-09-04).
  const filtered=await run([{field:'business_date',op:'range',value:['2026-09-03','2026-09-04']}],['net_merchandise_sales','cogs','gross_profit','contribution_pre_ads','expected_settlement']);
  const filteredBody=await filtered.json();
  assert.equal(filteredBody.result.coverage,'in-window');
  assert.equal(filteredBody.result.matchedOrders,1);
  assert.equal(filteredBody.result.metrics.net_merchandise_sales.value,'720000','known sales stay known');
  assert.equal(filteredBody.result.metrics.cogs.value,'400000','known cost stays known under a valid filter');
  assert.equal(filteredBody.result.metrics.gross_profit.value,'320000');
  assert.equal(filteredBody.result.metrics.contribution_pre_ads.value,'240000');
  assert.equal(filteredBody.result.metrics.expected_settlement.value,null,'settlement grain is not filterable by recognition date');
  assert.equal(filteredBody.result.metrics.expected_settlement.reason,'METRIC_GRAIN_UNFILTERABLE');
  // Empty-but-in-window range: honest zeros for count/sales, nulls elsewhere.
  const empty=await run([{field:'business_date',op:'range',value:['2026-09-10','2026-09-11']}],['net_merchandise_sales','recognized_order_count','cogs']);
  const emptyBody=await empty.json();
  assert.equal(emptyBody.result.coverage,'in-window');assert.equal(emptyBody.result.matchedOrders,0);
  assert.equal(emptyBody.result.metrics.net_merchandise_sales.value,'0');
  assert.equal(emptyBody.result.metrics.cogs.value,null,'no orders means no cost coverage to claim');
  // Out-of-window: explicit coverage marker, nulls, never zeros.
  const outside=await run([{field:'business_date',op:'range',value:['2027-01-01','2027-01-05']}],['net_merchandise_sales','recognized_order_count']);
  const outsideBody=await outside.json();
  assert.equal(outsideBody.result.coverage,'out-of-window');
  assert.equal(outsideBody.result.metrics.net_merchandise_sales.value,null,'out-of-window must not fabricate a zero');
  assert.equal(outsideBody.result.metrics.recognized_order_count.value,null);
 }finally{f.close();}
});

test('source dimension groups by provider account with explicit truncation',async t=>{
 const f=await commerceFixture(t);try{
  const a=await f.accept(exportBody('orders',[order()]),'orders-export','d-a');
  const buildA=await (await f.normalize(a.receiptId)).json();
  await f.connect('orders-2','orders','shop-B');
  const b=await f.accept(exportBody('orders',[order({id:'9007199254740994'})],{sourceAccountId:'shop-B'}),'orders-2','d-b');
  const buildB=await (await f.normalize(b.receiptId)).json();
  const mappingBody={evidenceRef:'reviewed-links',entries:[
   {sourceKey:buildA.normalizedRows?.[0]?.sourceKey??'so_'+('0'.repeat(48)),canonicalId:'order-1',priority:1}]};
  // Two sources with different accounts need reviewed links for every object.
  const preview=await call(f,'/api/commerce/publications/preview',{body:{normalizationIds:[buildA.normalizationId,buildB.normalizationId].sort(),mappingId:null,controls:[],expectedRevision:0,expectedPublicationId:null}});
  assert.equal(preview.status,422,'unreviewed cross-source identity is refused');
 }finally{f.close();}
});
