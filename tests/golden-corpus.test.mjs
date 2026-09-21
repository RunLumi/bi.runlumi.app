import test from 'node:test';
import assert from 'node:assert/strict';
import {commerceFixture,call,exportBody,order,settlement,stock} from './helpers.mjs';

/** Golden corpus: one synthetic merchant dataset pushed through the real HTTP
 * query, saved-run and analyst paths. EVERY expectation below is computed by
 * hand here — the implementation under test is never used to derive them.
 *
 * Cohort (all recognized, UTC+7 business days):
 *   o1 bd09-02 net 720,000 cogs 400,000 fees 80,000  -> contribution 240,000
 *   o2 bd09-05 net 500,000 cogs NULL    fees NULL    -> gross/contribution NULL
 *   o3 bd09-10 net 100,000 cogs 150,000 fees 0       -> gross -50,000 contribution -50,000
 *   o4 bd09-15 net 200,000 cogs NULL    fees NULL    -> gross/contribution NULL
 *   o5 bd09-19 net 300,000 cogs 100,000 fees 10,000  -> gross 200,000 contribution 190,000
 *   o6 bd09-19 net      0 cogs NULL    fees NULL    -> gross/contribution NULL (real zero sales)
 *   Late recognition: o5 ordered 09-02, recognized 09-19 (still in cohort).
 *   Boundary: o1 recognized 2026-09-01T17:00Z == UTC+7 midnight => bd 09-02.
 *   Large ID: o4's source id > Number.MAX_SAFE_INTEGER.
 *   Zero vs absent: o6 is a real zero-sale order; o2's cost is absent (null).
 * Totals: count=6, sales=1,820,000, aov=303,333.333333 (6dp, half away from zero).
 * Settlement: expected 520,000; observed cash 500,000; gap 20,000.
 * Stock: one physical pool with available=10.
 */

const ORDERS=[
 order({id:'9007199254740993',orderedAt:'2026-08-31T18:30:00.000Z',recognizedAt:'2026-09-01T17:00:00.000Z'}),
 order({id:'o-2',orderedAt:'2026-09-04T02:00:00.000Z',recognizedAt:'2026-09-05T10:00:00.000Z',merchandise:'500000',sellerDiscount:'0',merchandiseReversal:'0',cogs:null,cogsEvidenceRef:null,variableFees:null}),
 order({id:'o-3',orderedAt:'2026-09-09T02:00:00.000Z',recognizedAt:'2026-09-10T12:00:00.000Z',merchandise:'100000',sellerDiscount:'0',merchandiseReversal:'0',cogs:'150000',variableFees:'0'}),
 order({id:'900719925474099999999999',orderedAt:'2026-09-14T02:00:00.000Z',recognizedAt:'2026-09-15T10:00:00.000Z',merchandise:'200000',sellerDiscount:'0',merchandiseReversal:'0',cogs:null,cogsEvidenceRef:null,variableFees:null}),
 order({id:'o-5',orderedAt:'2026-09-02T02:00:00.000Z',recognizedAt:'2026-09-19T10:00:00.000Z',merchandise:'300000',sellerDiscount:'0',merchandiseReversal:'0',cogs:'100000',variableFees:'10000'}),
 order({id:'o-6',orderedAt:'2026-09-18T02:00:00.000Z',recognizedAt:'2026-09-19T20:00:00.000Z',merchandise:'0',sellerDiscount:'0',merchandiseReversal:'0',cogs:null,cogsEvidenceRef:null,variableFees:null})
];
const OBSERVED=new Date(Date.now()-3_600_000).toISOString();
const at=ms=>new Date(ms).toISOString();

async function publishCorpus(f){
 await f.connect('settlements-export','settlements','shop-A');
 await f.connect('stock-export','inventory','shop-A');
 const ids=[];
 for(const [raw,conn,delivery] of [
  [exportBody('orders',ORDERS,{observedAt:OBSERVED,window:{from:'2026-08-30T00:00:00.000Z',toExclusive:'2026-09-21T00:00:00.000Z'}}),'orders-export','g-o'],
  [exportBody('settlements',[settlement()],{observedAt:OBSERVED,window:{from:'2026-08-30T00:00:00.000Z',toExclusive:'2026-09-21T00:00:00.000Z'}}),'settlements-export','g-s'],
  [exportBody('inventory',[stock()],{observedAt:OBSERVED,window:{from:'2026-08-30T00:00:00.000Z',toExclusive:'2026-09-21T00:00:00.000Z'}}),'stock-export','g-i']]){
  const r=await f.accept(raw,conn,delivery);
  ids.push((await (await f.normalize(r.receiptId)).json()).normalizationId);
 }
 const body={normalizationIds:ids.sort(),mappingId:null,controls:[],expectedRevision:0,expectedPublicationId:null};
 const view=await (await call(f,'/api/commerce/publications/preview',{body})).json();
 const publish=await call(f,'/api/commerce/publications',{body:{...body,previewHash:view.previewHash,reason:'golden corpus'}});
 if(publish.status!==201)throw new Error(await publish.text());
 return (await publish.json()).publicationId;
}
const query=(f,pid,metrics,filters=[])=>call(f,'/api/commerce/queries',{body:{contract:'lumi.query.v1',metrics:metrics.map(id=>({id,version:1})),dimensions:[],filters,limit:50,consistency:'published',dataVersion:pid}});

test('golden corpus: whole-publication query matches hand-computed totals',async t=>{
 const f=await commerceFixture(t);try{
  const pid=await publishCorpus(f);
  const r=await query(f,pid,['net_merchandise_sales','recognized_order_count','cogs','gross_profit','contribution_pre_ads','expected_settlement','observed_cash_received','unreconciled_payout_amount','available_units','physical_pool_variant_count']);
  if(r.status!==200)throw new Error(await r.text());
  const {result}=await r.json();
  const cell=id=>result.metrics[id];
  // Hand-computed cohort totals.
  assert.equal(cell('recognized_order_count').value,'6');
  assert.equal(cell('net_merchandise_sales').value,'1820000');
  // Known only where the whole cohort has coverage: absent inputs stay null.
  assert.equal(cell('cogs').value,null,'two of six orders lack cost coverage');
  assert.equal(cell('gross_profit').value,null);
  assert.equal(cell('contribution_pre_ads').value,null);
  // Settlement hand-check: 700,000 -70,000 -100,000 +20,000 -30,000 = 520,000.
  assert.equal(cell('expected_settlement').value,'520000');
  assert.equal(cell('observed_cash_received').value,'500000');
  assert.equal(cell('unreconciled_payout_amount').value,'20000');
  assert.equal(cell('available_units').value,'10');
  assert.equal(cell('physical_pool_variant_count').value,'1');
  // AOV on the filtered single-order window: 720,000 / 1.
  const aov=await (await query(f,pid,['net_aov'],[{field:'business_date',op:'range',value:['2026-09-02','2026-09-03']}])).json();
  assert.equal(aov.result.metrics.net_aov.value,'720000.000000');
 }finally{f.close();}
});

test('golden corpus: UTC+7 business-day windows are exact at the midnight boundary',async t=>{
 const f=await commerceFixture(t);try{
  const pid=await publishCorpus(f);
  // o1 recognized 2026-09-01T17:00Z is business day 09-02 (UTC+7 midnight):
  // the half-open window [09-01,09-02) must NOT include it.
  const before=await (await query(f,pid,['recognized_order_count'],[{field:'business_date',op:'range',value:['2026-09-01','2026-09-02']}])).json();
  assert.equal(before.result.metrics.recognized_order_count.value,'0');
  assert.equal(before.result.matchedOrders,0);
  // The window [09-02,09-03) contains exactly o1: sales 720,000, cost 400,000.
  const o1=await (await query(f,pid,['net_merchandise_sales','cogs','gross_profit','contribution_pre_ads'],[{field:'business_date',op:'range',value:['2026-09-02','2026-09-03']}])).json();
  assert.equal(o1.result.matchedOrders,1);
  assert.equal(o1.result.metrics.net_merchandise_sales.value,'720000');
  assert.equal(o1.result.metrics.cogs.value,'400000');
  assert.equal(o1.result.metrics.gross_profit.value,'320000');
  assert.equal(o1.result.metrics.contribution_pre_ads.value,'240000');
  // Per-day split across the corpus: 09-05 -> o2 only; known-cost NULL stays NULL.
  const o2=await (await query(f,pid,['net_merchandise_sales','recognized_order_count','cogs','gross_profit'],[{field:'business_date',op:'range',value:['2026-09-05','2026-09-06']}])).json();
  assert.equal(o2.result.metrics.recognized_order_count.value,'1');
  assert.equal(o2.result.metrics.net_merchandise_sales.value,'500000');
  assert.equal(o2.result.metrics.cogs.value,null,'absent cost input is null, not zero');
  assert.equal(o2.result.metrics.gross_profit.value,null);
  // Negative contribution is preserved exactly.
  const o3=await (await query(f,pid,['net_merchandise_sales','contribution_pre_ads'],[{field:'business_date',op:'range',value:['2026-09-10','2026-09-11']}])).json();
  assert.equal(o3.result.metrics.net_merchandise_sales.value,'100000');
  assert.equal(o3.result.metrics.contribution_pre_ads.value,'-50000');
  // Late recognition lands on the recognition business day (09-19), not the order day.
  const o5=await (await query(f,pid,['recognized_order_count','net_merchandise_sales','contribution_pre_ads'],[{field:'business_date',op:'range',value:['2026-09-19','2026-09-20']}])).json();
  assert.equal(o5.result.matchedOrders,1,'o5 only; o6 recognized 20:00Z is bd 09-20 in UTC+7');
  assert.equal(o5.result.metrics.net_merchandise_sales.value,'300000');
  assert.equal(o5.result.metrics.recognized_order_count.value,'1');
  assert.equal(o5.result.metrics.contribution_pre_ads.value,'190000');
  // o6 (recognized 2026-09-19T20:00Z -> bd 09-20): a real zero-sale order.
  const o6=await (await query(f,pid,['recognized_order_count','net_merchandise_sales'],[{field:'business_date',op:'range',value:['2026-09-20','2026-09-21']}])).json();
  assert.equal(o6.result.matchedOrders,1);
  assert.equal(o6.result.metrics.recognized_order_count.value,'1');
  assert.equal(o6.result.metrics.net_merchandise_sales.value,'0','a zero-sale order is a real zero, not absent');
 }finally{f.close();}
});

test('golden corpus: saved run reproduces hand-computed values; analyst cites the pinned publication',async t=>{
 const f=await commerceFixture(t);try{
  const pid=await publishCorpus(f);
  const create=await call(f,'/api/commerce/insights',{body:{id:'golden',title:'Golden review',definition:{metricIds:['net_merchandise_sales','cogs'],from:'2026-09-01',toExclusive:'2026-09-21',dataVersion:pid,blocks:[{id:'s',kind:'metric',metricId:'net_merchandise_sales'}]}}});
  if(create.status!==201)throw new Error(await create.text());
  const insight=await create.json();
  // Saved run resolves over the FULL recognition window: sales 1,820,000; cohort cost absent -> null.
  assert.equal(insight.result.metrics.net_merchandise_sales.value,'1820000');
  assert.equal(insight.result.metrics.cogs.value,null);
  assert.equal(insight.result.coverage,'in-window');
  // Pinned rerun returns the same numbers deterministically.
  const refresh=await call(f,'/api/commerce/insights/golden/refresh',{body:{expectedRevision:1}});
  assert.equal(refresh.status,200);
  const refreshed=await refresh.json();
  assert.equal(refreshed.basis,'pinned');
  assert.equal(refreshed.result.metrics.net_merchandise_sales.value,'1820000');
  // Refresh against the latest publication: same head -> allowed; stale id -> conflict.
  const bad=await call(f,'/api/commerce/insights/golden/refresh',{body:{expectedRevision:2,dataVersion:pid}});
  assert.equal(bad.status,200,'the pinned id IS the active head here, so a latest refresh is accepted');
  const stale=await call(f,'/api/commerce/insights/golden/refresh',{body:{expectedRevision:3,dataVersion:'cp_not_the_head'}});
  assert.equal(stale.status,409);assert.equal((await stale.json()).error.code,'INSIGHT_REFRESH_NOT_LATEST');
  // Analyst: curated path answers sales from the pinned publication and labels itself.
  const ask=await call(f,'/api/commerce/ask',{body:{question:'Doanh thu kỳ này là bao nhiêu?',dataVersion:pid}});
  assert.equal(ask.status,200);
  const answer=await ask.json();
  assert.equal(answer.status,'ANSWERED');
  assert.equal(answer.mode,'curated-deterministic');
  assert.equal(answer.llmInvolved,false);
  assert.equal(answer.claims[0].value,'1820000');
  // Duplicate save with a different definition must not attach a run silently.
  const dup=await call(f,'/api/commerce/insights',{body:{id:'golden',title:'Golden review',definition:{metricIds:['cogs'],from:'2026-09-01',toExclusive:'2026-09-22',dataVersion:pid,blocks:[{id:'c',kind:'metric',metricId:'cogs'}]}}});
  assert.equal(dup.status,409);assert.equal((await dup.json()).error.code,'INSIGHT_DEFINITION_CONFLICT');
 }finally{f.close();}
});
