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
  assert.equal(body.result.net_merchandise_sales.value,'720000');
  assert.equal(body.result.available_units.value,'10');
  assert.equal(body.result.physical_pool_variant_count.value,'1');
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
  assert.equal(body.result.recognized_order_count.value,'1','only the recognized order counts');
  assert.equal(body.result.cogs.value,'400000','unrecognized orders contribute nothing');
  assert.equal(body.result.gross_profit.value,'320000');
  assert.equal(body.result.contribution_pre_ads.value,'240000','recognized order has complete cost coverage');
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
