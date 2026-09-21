import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,request,localAuthenticate} from '../scripts/local-adapters.mjs';
import {createApi} from '@runlumi/core/api.ts';
import {AppError} from '@runlumi/core/contracts.ts';
import {customMetricExtensions} from '../starter/customer/customer/data/server-metrics.ts';
import {exampleAdapter} from '../starter/customer/customer/data/connectors.ts';
import {decisionRules} from '../starter/customer/customer/workflows/decisions.ts';
// Independent in-repo evidence for PR3: the SAME starter customer extensions the
// generated repositories ship (custom metrics, connector adapter, decision rules)
// are composed against the local fixture network and must execute end to end:
// server-constructed pulls, idempotent replay, exact HTTP values, NULL-not-zero,
// and binary-stable composition rejection. This proves the template suite runs
// real code rather than static metadata.

/** Wrap the starter adapter so the test can assert the server-constructed request. */
function pullSpy(){
 const pulled=[];
 const adapter={...exampleAdapter,pull:async request=>{pulled.push(request);return exampleAdapter.pull(request);}};
 return {adapter,pulled};
}

/** Compose a fresh API over the fixture env with the starter extensions enabled. */
function compose(env,{modules=['commerce','operations'],customMetrics=customMetricExtensions,connectors=[exampleAdapter],rules=decisionRules}={}){
 return createApi(localAuthenticate,true,{customMetrics,connectors,decisionRules:rules,modules});
}

test('connector pull is server-constructed: deployment config, not browser input',async()=>{
 const {env,close}=await fixture({seed:false});
 try{
  const {adapter,pulled}=pullSpy();
  const api=compose(env,{connectors:[adapter]});
  const response=await api(request('/api/tenants/alpha/connector-pull/ops-demo',{user:'alpha-owner',method:'POST'}),env);
  assert.equal(response.status,201);
  assert.equal(pulled.length,1);
  const req=pulled[0];
  assert.equal(req.connectionId,'customer-deployment');
  assert.equal(req.resourceType,'workflow_facts');
  assert.deepEqual(req.window,{from:'2026-09-01',toExclusive:'2026-10-01'});
  assert.ok(!Number.isNaN(Date.parse(req.observedAt)),'observedAt must be an ISO instant');
  const body=await response.json();
  assert.equal(body.provider,'ops-demo');
  assert.equal(body.sourceId,'ops-demo');
  assert.equal(body.recordCount,1);
  assert.equal(body.observedThrough,'2026-09-18');
  assert.ok(body.snapshotId&&!body.replayed,'first pull is a fresh publication');
 }finally{close();}
});

test('replaying the same pull is idempotent: 200, same snapshotId, replayed true',async()=>{
 const {env,close}=await fixture({seed:false});
 try{
  const api=compose(env);
  const first=await (await api(request('/api/tenants/alpha/connector-pull/ops-demo',{user:'alpha-owner',method:'POST'}),env)).json();
  const secondResponse=await api(request('/api/tenants/alpha/connector-pull/ops-demo',{user:'alpha-owner',method:'POST'}),env);
  assert.equal(secondResponse.status,200);
  const second=await secondResponse.json();
  assert.equal(second.snapshotId,first.snapshotId);
  assert.equal(second.replayed,true);
 }finally{close();}
});

test('alpha custom metric returns the exact deterministic value over HTTP',async()=>{
 const {env,close}=await fixture({seed:false});
 try{
  const api=compose(env);
  const pulled=await api(request('/api/tenants/alpha/connector-pull/ops-demo',{user:'alpha-owner',method:'POST'}),env);
  assert.equal(pulled.status,201);
  const response=await api(request('/api/tenants/alpha/custom-metrics/customer.example_hours_saved',{user:'alpha-owner'}),env);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.id,'customer.example_hours_saved');
  assert.equal(body.version,1);
  assert.equal(body.value,'2.5');
  assert.equal(body.unit,'hours');
  assert.deepEqual(body.scope,{tenantId:'alpha',role:'owner'});
  assert.equal(typeof body.coreVersion,'string');
 }finally{close();}
});

test('an empty database returns null, never a fabricated zero',async()=>{
 const {env,close}=await fixture({seed:false});
 try{
  const api=compose(env);
  // beta has the source registered (fixture) but no published snapshot: the
  // aggregate must surface null/matched_rows:0, not '0'.
  const response=await api(request('/api/tenants/beta/custom-metrics/customer.example_hours_saved',{user:'beta-owner'}),env);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.value,null);
  assert.equal(body.unit,'hours');
 }finally{close();}
});

test('a viewer cannot pull connector data (owner required)',async()=>{
 const {env,close}=await fixture({seed:false});
 try{
  const api=compose(env);
  const response=await api(request('/api/tenants/alpha/connector-pull/ops-demo',{user:'alpha-viewer',method:'POST'}),env);
  assert.equal(response.status,403);
  assert.match(await response.text(),/OWNER_REQUIRED/);
 }finally{close();}
});

test('composition validation is binary-stable: external actions are rejected',()=>{
 const badRule={...decisionRules[0],externalAction:true};
 assert.throws(()=>compose({},{rules:[badRule]}),AppError,'must throw an AppError');
 assert.throws(()=>createApi(localAuthenticate,true,{decisionRules:[badRule]}),/EXTERNAL_ACTION_NOT_ALLOWED/);
 assert.throws(()=>createApi(localAuthenticate,true,{decisionRules:[{...decisionRules[0],then:{label:'x',suggestedOwnerRole:'admin'}}]}),/INVALID_SUGGESTED_ROLE/);
});

test('composition validation rejects unsupported connector transports and modules',()=>{
 const badTransport={...exampleAdapter,transport:'webhook'};
 const badProvider={...exampleAdapter,provider:'Nope Nope'};
 const badResources={...exampleAdapter,resources:['fraud_scores']};
 assert.throws(()=>createApi(localAuthenticate,true,{connectors:[badTransport]}),/UNSUPPORTED_CONNECTOR_TRANSPORT/);
 assert.throws(()=>createApi(localAuthenticate,true,{connectors:[badProvider]}),/INVALID_CONNECTOR_PROVIDER/);
 assert.throws(()=>createApi(localAuthenticate,true,{connectors:[badResources]}),/INVALID_CONNECTOR_RESOURCES/);
 assert.throws(()=>createApi(localAuthenticate,true,{modules:['bogus']}),/INVALID_MODULE_CONFIG/);
});

test('custom rules are a read-only catalog served from the composed extension',async()=>{
 const {env,close}=await fixture({seed:false});
 try{
  const api=compose(env);
  const response=await api(request('/api/tenants/alpha/custom-rules',{user:'alpha-owner'}),env);
  assert.equal(response.status,200);
  const body=await response.json();
  assert.equal(body.version,'operations-v1');
  assert.deepEqual(body.rules.map(r=>r.id),decisionRules.map(r=>r.id));
  assert.deepEqual(body.scope,{tenantId:'alpha',role:'owner'});
  const post=await api(request('/api/tenants/alpha/custom-rules',{user:'alpha-owner',method:'POST',body:{id:'customer.breakout'}}),env);
  assert.equal(post.status,404);
 }finally{close();}
});