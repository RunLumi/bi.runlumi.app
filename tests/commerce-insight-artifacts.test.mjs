import test from 'node:test';
import assert from 'node:assert/strict';
import {commerceFixture,exportBody,order} from './commerce-helpers.mjs';
const ok=async(response,status=200)=>{const body=await response.json();assert.equal(response.status,status,JSON.stringify(body));return body;};
async function publish(f){const receipt=await f.accept(exportBody('orders',[order({cogs:'800000'})]),'orders-export','insight-seed');const build=await ok(await f.normalize(receipt.receiptId));const input={normalizationIds:[build.normalizationId],mappingId:null,controls:[],expectedRevision:0,expectedPublicationId:null};const preview=await ok(await f.call('commerce-publications/preview',input));return ok(await f.call('commerce-publications',{...input,previewHash:preview.previewHash,reason:'Insight lifecycle fixture'}),201);}
test('saved insight reloads and refresh creates an immutable pinned run',async t=>{
 const f=await commerceFixture(t),publication=await publish(f);const definition={metricIds:['net_merchandise_sales'],from:'2026-09-01',toExclusive:'2026-10-01',dataVersion:publication.publicationId,blocks:[{id:'sales-card',kind:'metric',metricId:'net_merchandise_sales'},{id:'sales-table',kind:'table',metricId:'net_merchandise_sales'},{id:'sales-target',kind:'target',metricId:'net_merchandise_sales',target:'1000000'}]};
 const created=await ok(await f.call('commerce-insights',{id:'insight-weekly-sales',title:'Weekly sales',definition}),201);assert.equal(created.result.net_merchandise_sales.value,'720000');
 const broken=await ok(await f.call('commerce-insights',{id:'insight-source-sales',title:'Source sales',definition:{...definition,dimension:'source',blocks:[{id:'source-table',kind:'table',metricId:'net_merchandise_sales'}]}}),201);assert.equal(Array.isArray(broken.result),true);assert.equal(broken.result[0].metrics.net_merchandise_sales.value,'720000');
 assert.equal((await f.call('commerce-insights',{id:'insight-bad-target',title:'Bad target',definition:{...definition,blocks:[{id:'bad-target',kind:'target',metricId:'net_merchandise_sales',target:{value:'1',unit:'hours',period:'2026-09-01/2026-10-01'}}]}})).status,422);
 const loaded=await ok(await f.call('commerce-insights/insight-weekly-sales'));assert.equal(loaded.insights[0].runs.length,1);assert.equal(loaded.insights[0].runs[0].publication_id,publication.publicationId);
 const refreshed=await ok(await f.call('commerce-insights/insight-weekly-sales',{expectedRevision:1},{method:'PUT'}));assert.equal(refreshed.revision,2);assert.notEqual(refreshed.runId,created.runId);
 const after=await ok(await f.call('commerce-insights/insight-weekly-sales'));assert.deepEqual(after.insights[0].runs.map(r=>r.revision),[2,1]);
 assert.equal((await f.call('commerce-insights/insight-weekly-sales',{expectedRevision:1},{method:'PUT'})).status,409);
 const proposal=await ok(await f.call('commerce-insights',{action:'promote',insightId:'insight-weekly-sales'}));assert.equal(proposal.path,'customer/reports/insight-weekly-sales.report.tsx');assert.equal(proposal.hardCodedResults,false);assert.match(proposal.source,/reportDefinition/);assert.doesNotMatch(proposal.source,/720000/);assert.equal(proposal.approvalRequired,true);
});
