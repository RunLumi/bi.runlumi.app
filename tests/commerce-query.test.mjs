import test from 'node:test';
import assert from 'node:assert/strict';
import {commerceMetricCatalog,parseCommerceQuery,queryCommerceReport} from '@runlumi/core/commerce-query.ts';
import {commerceFixture,exportBody,order} from './commerce-helpers.mjs';

const query=(dataVersion,metrics=[{id:'net_merchandise_sales',version:1}],extra={})=>({contract:'lumi.query.v1',metrics,dimensions:[],filters:[],limit:1,consistency:'published',dataVersion,...extra});
const ok=async(response,status=200)=>{const body=await response.json();assert.equal(response.status,status,JSON.stringify(body));return body;};
async function publish(f){
 const receipt=await f.accept();const normalized=await ok(await f.normalize(receipt.receiptId));
 const body={normalizationIds:[normalized.normalizationId],mappingId:null,controls:[],expectedRevision:0,expectedPublicationId:null};
 const preview=await ok(await f.call('commerce-publications/preview',body));
 return ok(await f.call('commerce-publications',{...body,previewHash:preview.previewHash,reason:'query contract test'}),201);
}

test('catalog exposes only reviewed versioned commerce metrics',()=>{
 const catalog=commerceMetricCatalog();assert(catalog.length>=5);assert(catalog.every(metric=>metric.version===1&&metric.id&&!metric.expression));
 assert.equal(new Set(catalog.map(metric=>metric.id)).size,catalog.length);
});

test('query parser rejects raw identifiers, dimensions, duplicate metrics and unbounded limits',()=>{
 for(const bad of [
  query('cp_abc',[{id:'DROP TABLE commerce_publications',version:1}]),
  query('cp_abc',[{id:'net_merchandise_sales',version:1},{id:'net_merchandise_sales',version:1}]),
  query('cp_abc',undefined,{dimensions:['channel']}),
  query('cp_abc',undefined,{limit:100}),
  query('cp_abc',undefined,{consistency:'latest'}),
  query('cp_abc',undefined,{filters:[{field:'metric',op:'eq',value:'x'}]})
 ])assert.throws(()=>parseCommerceQuery(bad));
 assert.deepEqual(parseCommerceQuery(query('cp_abc',[{id:'net_merchandise_sales',version:1}])),query('cp_abc'));
});

test('query report preserves exact strings and null availability',()=>{
 const result=queryCommerceReport({metrics:{net_merchandise_sales:'720000',gross_profit:null}},parseCommerceQuery(query('cp_1',[{id:'net_merchandise_sales',version:1},{id:'gross_profit',version:1}])));
 assert.deepEqual(result,{net_merchandise_sales:{value:'720000',unit:'VND',metricVersion:1},gross_profit:{value:null,unit:'VND',metricVersion:1}});
 assert.throws(()=>queryCommerceReport({metrics:{gross_profit:0}},parseCommerceQuery(query('cp_1',[{id:'gross_profit',version:1}]))));
});

test('source breakdown is bounded, filtered and uses the same exact order metrics',()=>{
 const report={orders:[
  {sourceKey:'so_a',recognizedAt:'2026-09-03T00:00:00.000Z',merchandise:'1000000',sellerDiscount:'0',merchandiseReversal:'0',cogs:null,variableFees:null,shippingIncome:null,earnedSubsidy:null},
  {sourceKey:'so_b',recognizedAt:'2026-09-03T00:00:00.000Z',merchandise:'2000000',sellerDiscount:'0',merchandiseReversal:'0',cogs:null,variableFees:null,shippingIncome:null,earnedSubsidy:null}
 ],metrics:{}};
 const result=queryCommerceReport(report,parseCommerceQuery(query('cp_1',[{id:'net_merchandise_sales',version:1}],{dimensions:['source'],filters:[{field:'business_date',op:'range',value:['2026-09-01','2026-10-01']}],limit:10})));
 assert.deepEqual(result.map(row=>[row.dimension,row.metrics.net_merchandise_sales.value]),[['so_a','1000000'],['so_b','2000000']]);
});
test('comparison periods require equal explicit windows and return separate exact cells',()=>{
 const report={orders:[{sourceKey:'so_a',recognizedAt:'2026-09-03T00:00:00.000Z',merchandise:'1000000',sellerDiscount:'0',merchandiseReversal:'0',cogs:null,variableFees:null,shippingIncome:null,earnedSubsidy:null},{sourceKey:'so_a',recognizedAt:'2026-08-03T00:00:00.000Z',merchandise:'500000',sellerDiscount:'0',merchandiseReversal:'0',cogs:null,variableFees:null,shippingIncome:null,earnedSubsidy:null}],metrics:{net_merchandise_sales:'1000000'}};
 const q=parseCommerceQuery(query('cp_1',[{id:'net_merchandise_sales',version:1}],{filters:[{field:'business_date',op:'range',value:['2026-09-01','2026-10-01']}],comparison:{from:'2026-08-01',toExclusive:'2026-09-01'}}));
 assert.equal(queryCommerceReport(report,q).current.net_merchandise_sales.value,'1000000');assert.equal(queryCommerceReport(report,q).comparison.net_merchandise_sales.value,'500000');
 assert.throws(()=>parseCommerceQuery(query('cp_1',undefined,{comparison:{from:'2026-09-01',toExclusive:'2026-08-15'}})));
});

test('API serves one published context and denies cross-tenant or stale publication access',async t=>{
 const f=await commerceFixture(t),publication=await publish(f);
 const body=query(publication.publicationId);
 const response=await f.call('commerce-query',body);const result=await ok(response);
 assert.equal(result.dataVersion,publication.publicationId);assert.equal(result.metrics.net_merchandise_sales.value,'720000');assert.equal(result.quality.state,'PROVISIONAL');assert.equal(result.lineage.publicationId,publication.publicationId);assert.match(response.headers.get('cache-control'),/no-store/);
 assert.equal((await f.call('commerce-query',query('missing'))).status,404);
 const beta=await f.api(new Request(`http://localhost:8787/api/tenants/beta/commerce-query`,{method:'POST',headers:{'content-type':'application/json','x-demo-user':'beta-owner'},body:JSON.stringify(body)}),f.env);assert.equal(beta.status,404);
});

test('API query never falls back to raw or old data when publication is absent',async t=>{
 const f=await commerceFixture(t),response=await f.call('commerce-query',query('cp_missing'));
 assert.equal(response.status,404);
 const catalog=await ok(await f.api(new Request('http://localhost:8787/api/tenants/alpha/commerce-metrics',{headers:{'x-demo-user':'alpha-owner'}}),f.env));assert.equal(catalog.contract,'lumi.query.v1');
});

test('viewer receives non-sensitive commerce metrics but cannot recover cost or fee fields',async t=>{
 const f=await commerceFixture(t),publication=await publish(f),body=query(publication.publicationId);
 const viewer=await f.api(new Request('http://localhost:8787/api/tenants/alpha/commerce-query',{method:'POST',headers:{'content-type':'application/json','x-demo-user':'alpha-viewer'},body:JSON.stringify(body)}),f.env);
 assert.equal(viewer.status,200);const result=await viewer.json();assert.equal(result.metrics.net_merchandise_sales.value,'720000');assert.equal(result.scope.role,'viewer');
 const denied=await f.api(new Request('http://localhost:8787/api/tenants/alpha/commerce-query',{method:'POST',headers:{'content-type':'application/json','x-demo-user':'alpha-viewer'},body:JSON.stringify(query(publication.publicationId,[{id:'gross_profit',version:1}]))}),f.env);assert.equal(denied.status,403);
});
