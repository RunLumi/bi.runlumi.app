import test from 'node:test';
import assert from 'node:assert/strict';
import {commerceFixture,exportBody} from './commerce-helpers.mjs';
const body={id:'new-source',provider:'nhanh',sourceAccountId:'merchant-1',resourceType:'orders',approvalRef:'owner-export-approval'};
test('owner can authorize an export source but cannot claim live provider verification',async t=>{
 const f=await commerceFixture(t),r=await f.call('commerce-connections',body);assert.equal(r.status,201);assert.equal((await r.json()).liveProviderVerified,false);
 const list=await(await f.call('commerce-connections')).json();assert.equal(list.connections.length,2);assert.equal(list.connections[0].transport,'authorized-export');
 assert.equal((await f.call('commerce-connections',body)).status,409);assert.equal((await f.call('commerce-connections',{...body,id:'secret',credentials:'forbidden'})).status,400);
});
for(const user of ['alpha-editor','alpha-viewer','beta-owner','platform-admin'])test(`source onboarding denies ${user}`,async t=>{
 const f=await commerceFixture(t);assert.equal((await f.call('commerce-connections',body,{user})).status,403);assert.equal((await f.call('commerce-connections',undefined,{user})).status,403);
});
test('source changes require strong revision; revoked source cannot be resurrected',async t=>{
 const f=await commerceFixture(t);const path='commerce-connections/orders-export';assert.equal((await f.call(path,{state:'paused',reason:'review'},{method:'PUT'})).status,428);
 const paused=await f.call(path,{state:'paused',reason:'review'},{method:'PUT',headers:{'if-match':'"1"'}});assert.equal(paused.status,200);
 assert.equal((await f.call(path,{state:'active',reason:'old'},{method:'PUT',headers:{'if-match':'"1"'}})).status,409);
 assert.equal((await f.call(path,{state:'revoked',reason:'consent revoked'},{method:'PUT',headers:{'if-match':'"2"'}})).status,200);
 assert.equal((await f.call(path,{state:'active',reason:'not allowed'},{method:'PUT',headers:{'if-match':'"3"'}})).status,409);
});
test('source onboarding cap is checked inside the insertion transaction',async t=>{
 const f=await commerceFixture(t);for(let i=1;i<50;i++)f.connect('source-'+i);
 assert.equal((await f.call('commerce-connections',body)).status,409);assert.equal(f.env.TENANT_A.db.prepare('SELECT COUNT(*) AS n FROM commerce_connections').get().n,50);
});
