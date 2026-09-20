import test from 'node:test';
import assert from 'node:assert/strict';
import {commerceFixture} from './commerce-helpers.mjs';

const capability={connectionId:'orders-export',capabilityId:'fees',state:'MISSING_SCOPE',evidenceRef:'owner-reviewed-fee-scope',testedAt:'2026-09-20',coverage:{requestedWindow:{from:'2026-09-01',toExclusive:'2026-10-01'},fetchedWindow:null,sourceConfirmedWindow:null,publishedWindow:null,shops:['shop-A'],warehouses:[],fieldsMasked:['fee_type']}};
const ok=async(response,status=200)=>{const body=await response.json();assert.equal(response.status,status,JSON.stringify(body));return body;};

test('owner reviews per-resource capability and coverage without claiming live verification',async t=>{
 const f=await commerceFixture(t),created=await ok(await f.call('commerce-capabilities',capability),201);assert.equal(created.state,'MISSING_SCOPE');assert.equal(created.revision,1);assert.equal(created.liveProviderVerified,false);
 const listed=await ok(await f.call('commerce-capabilities'));assert.equal(listed.liveProviderVerified,false);assert.deepEqual(listed.connections[0].capabilities[0].coverage.warehouses,[]);assert.equal(listed.connections[0].capabilities[0].state,'MISSING_SCOPE');
});

for(const user of ['alpha-editor','alpha-viewer','beta-owner','platform-admin'])test(`capability review denies ${user}`,async t=>{
 const f=await commerceFixture(t);assert.equal((await f.call('commerce-capabilities',capability,{user})).status,403);assert.equal((await f.call('commerce-capabilities',undefined,{user})).status,403);
});

test('capability updates require optimistic revision and preserve tenant scope',async t=>{
 const f=await commerceFixture(t);await ok(await f.call('commerce-capabilities',capability),201);
 assert.equal((await f.call('commerce-capabilities',{...capability,state:'SUPPORTED'})).status,428);
 assert.equal((await f.call('commerce-capabilities',{...capability,state:'SUPPORTED',expectedRevision:9})).status,409);
 const updated=await ok(await f.call('commerce-capabilities',{...capability,state:'DEGRADED',expectedRevision:1}),201);assert.equal(updated.revision,2);
 const foreign=await f.api(new Request('http://localhost:8787/api/tenants/beta/commerce-capabilities',{method:'POST',headers:{'content-type':'application/json','x-demo-user':'beta-owner'},body:JSON.stringify(capability)}),f.env);assert.equal(foreign.status,404);
});

test('invalid capability state, resource and coverage are rejected before persistence',async t=>{
 const f=await commerceFixture(t);
 for(const bad of [{state:'READY'},{capabilityId:'raw_sql'},{coverage:{...capability.coverage,warehouses:['x'.repeat(129)]}},{testedAt:'2026-02-30'}])assert([400,422].includes((await f.call('commerce-capabilities',{...capability,...bad})).status));
 assert.equal(f.env.TENANT_A.db.prepare('SELECT COUNT(*) AS n FROM commerce_capabilities').get().n,0);
});
