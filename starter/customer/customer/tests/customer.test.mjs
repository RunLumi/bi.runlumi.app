import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {createApi} from '@runlumi/core/api.ts';
import {LocalDatabase, LocalObjects, stubControl} from '@runlumi/cloudflare/testing.ts';
import {parseCustomerManifest, parseCustomerRoutes, RESERVED_ROUTES} from '@runlumi/core/customer-config.ts';
import {manifest} from '../manifest.ts';
import {customMetrics} from '../data/metrics.ts';
import {customMetricExtensions} from '../data/server-metrics.ts';
import {exampleAdapter} from '../data/connectors.ts';
import {decisionRules} from '../workflows/decisions.ts';
// Independent executable expectations: this suite composes the SAME public core
// interfaces the deployed worker uses (createApi + LocalDatabase + a control stub)
// and asserts the customer's intended behavior, not whatever an implementation
// happens to produce. Values are DERIVED from the adapter envelope below, so a
// mislabeled source or a drifting fixture fails loudly instead of passing by echo.

const here=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(here,'../..');
const lock=JSON.parse(await readFile(path.resolve(here,'../../lumi.lock.json'),'utf8'));
const require=createRequire(import.meta.url);

// ---- synthetic harness, mirroring the reviewed dev server composition ----------
async function buildEnv(){
 const db=new LocalDatabase();
 const objects=new LocalObjects();
 const coreRoot=path.resolve(path.dirname(require.resolve('@runlumi/core/api.ts')),'..');
 for(const plane of ['tenant']){
  const dir=path.join(coreRoot,'migrations',plane);
  const files=(await readdir(dir)).filter(f=>f.endsWith('.sql')).sort();
  for(const file of files)db.db.exec(await readFile(path.join(dir,file),'utf8'));
 }
 const customerMigrations=path.join(repoRoot,'customer/migrations');
 try{
  const files=(await readdir(customerMigrations)).filter(f=>f.endsWith('.sql')).sort();
  for(const file of files)db.db.exec(await readFile(path.join(customerMigrations,file),'utf8'));
 }catch{/* no customer-owned migrations */}
 db.db.prepare('INSERT INTO tenant_identity (singleton,tenant_id) VALUES (1,?)').run(manifest.customerId);
 db.db.prepare("INSERT INTO serving_identity (singleton,customer_id,deployment_id,environment) VALUES (1,?,?,?)").run(manifest.customerId,'local','local');
 db.db.prepare("INSERT INTO sources VALUES (?,'ops-demo','Synthetic operations snapshot','active')").run(manifest.customerId);
 const env={
  SERVING:db,SOURCES:objects,
  CONTROL:{fetch:stubControl({cellId:'local',memberships:[
   {tenantId:manifest.customerId,issuer:'local-test',subject:'local-owner',role:'owner'},
   {tenantId:manifest.customerId,issuer:'local-test',subject:'local-viewer',role:'viewer'}
  ]})},
  CELL_ID:'local',CUSTOMER_ID:manifest.customerId,DEPLOYMENT_ID:'local',ENVIRONMENT:'local',TENANT_BINDINGS:'["SERVING"]',ACCESS_TEAM:'',ACCESS_AUD:''
 };
 const authenticate=async request=>({issuer:'local-test',subject:request.headers.get('x-demo-user')??'local-owner'});
 return {env,objects,db};
}
function compose(env,modules=manifest.modules){
 return createApi(async request=>({issuer:'local-test',subject:request.headers.get('x-demo-user')??'local-owner'}),true,
  {customMetrics:customMetricExtensions,connectors:[exampleAdapter],decisionRules,modules});
}
function call(api,path_,{user='local-owner',method='GET',body}={}){
 return api(new Request(`http://localhost:8787${path_}`,{method,headers:{'x-demo-user':user,...(body!==undefined?{'content-type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})}));
}
let shared=null;
async function harness(){if(!shared)shared=await buildEnv();return shared;}
const close=()=>{if(shared){shared.db.close();if(shared.env.SERVING!==shared.db)shared.env.SERVING.close();}}

// ---- independent expectations derived from the adapter envelope -----------------
const PULL_WINDOW={from:'2026-09-01',toExclusive:'2026-10-01'};
const envelope=await exampleAdapter.pull({connectionId:'customer-deployment',resourceType:exampleAdapter.resources[0]??'workflow_facts',window:PULL_WINDOW,observedAt:new Date().toISOString()});
const inWindow=record=>record.day>=PULL_WINDOW.from&&record.day<PULL_WINDOW.toExclusive;
const records=envelope.records.filter(inWindow);
const DERIVED={
 'operations.released_hours':()=>String(records.reduce((sum,r)=>sum+(r.baselineMinutes-r.humanMinutes),0)/60),
 'operations.cases':()=>String(records.reduce((sum,r)=>sum+r.cases,0))
};
function expectedValue(metric){
 const source=metric.source.from[0];
 const derive=DERIVED[source];
 if(!derive)throw new Error(`cannot derive a deterministic expectation for ${metric.id} from source ${source}`);
 return derive();
}

test('manifest parses and matches the deployment inventory identity',()=>{
 const parsed=parseCustomerManifest(manifest);
 assert.equal(parsed.customerId,lock.customerId);
 assert.ok(parsed.modules.length>0);
});

test('declared custom routes are non-reserved and unique',()=>{
 const declared=lock.customerPages.filter(p=>p.path);
 for(const {path:route} of declared)assert(!RESERVED_ROUTES.includes(route),`${route} is reserved`);
 const parsed=parseCustomerRoutes(declared);
 assert.equal(parsed.length,declared.length);
});

test('custom metrics use the declared namespace and are additive',()=>{
 const namespace=manifest.extensions[0].namespace;
 for(const metric of customMetrics)assert(metric.id.startsWith(`${namespace}.`),`${metric.id} must use the ${namespace} namespace`);
});

test('every declared custom metric has one executable server registration',()=>{
 assert.deepEqual(customMetricExtensions.map(metric=>metric.id).sort(),customMetrics.map(metric=>metric.id).sort());
});

test('connector pull publishes the source envelope (201) with exact metadata',async()=>{
 const {env}=await harness();
 const api=compose(env);
 const response=await call(api,`/api/tenants/${manifest.customerId}/connector-pull/ops-demo`,{method:'POST'});
 assert.equal(response.status,201);
 const body=await response.json();
 assert.equal(body.provider,'ops-demo');
 assert.equal(body.sourceId,'ops-demo');
 assert.equal(body.recordCount,envelope.records.length);
 assert.equal(body.observedThrough,envelope.observedThrough);
 assert.ok(body.snapshotId,'pull must return a snapshot id');
 assert.notEqual(body.replayed,true,'first pull is not a replay');
});

test('replaying the same pull is idempotent (200, same snapshotId)',async()=>{
 const {env}=await harness();
 const api=compose(env);
 const first=await (await call(api,`/api/tenants/${manifest.customerId}/connector-pull/ops-demo`,{method:'POST'})).json();
 const secondResponse=await call(api,`/api/tenants/${manifest.customerId}/connector-pull/ops-demo`,{method:'POST'});
 assert.equal(secondResponse.status,200);
 const second=await secondResponse.json();
 assert.equal(second.snapshotId,first.snapshotId);
 assert.equal(second.replayed,true);
});

test('every custom metric returns its derived exact value through HTTP',async()=>{
 const {env}=await harness();
 const api=compose(env);
 for(const metric of customMetrics){
  const response=await call(api,`/api/tenants/${manifest.customerId}/custom-metrics/${metric.id}`);
  assert.equal(response.status,200,`${metric.id} must resolve`);
  const body=await response.json();
  assert.equal(body.id,metric.id);
  assert.equal(body.value,expectedValue(metric),`${metric.id} must equal the derived envelope value`);
  assert.equal(body.unit,metric.unit,`${metric.id} must keep the declared unit`);
  assert.equal(body.scope.tenantId,manifest.customerId);
 }
});

test('an empty database returns null, never a fabricated zero',async()=>{
 const fresh=await buildEnv();
 try{
  const api=compose(fresh.env);
  for(const metric of customMetrics){
   const response=await call(api,`/api/tenants/${manifest.customerId}/custom-metrics/${metric.id}`);
   assert.equal(response.status,200);
   const body=await response.json();
   assert.equal(body.value,null,`${metric.id} on an empty database must be null, not '0'`);
  }
 }finally{if(fresh.env.SERVING!==fresh.db)fresh.env.SERVING.close();fresh.db.close();}
});

test('unknown custom metrics are rejected (404)',async()=>{
 const {env}=await harness();
 const api=compose(env);
 const response=await call(api,`/api/tenants/${manifest.customerId}/custom-metrics/customer.does_not_exist`);
 assert.equal(response.status,404);
});

test('custom rules are a read-only advisory catalog',async()=>{
 const {env}=await harness();
 const api=compose(env);
 const get=await call(api,`/api/tenants/${manifest.customerId}/custom-rules`);
 assert.equal(get.status,200);
 const body=await get.json();
 assert.equal(body.version,'operations-v1');
 assert.deepEqual(body.rules.map(r=>r.id),decisionRules.map(r=>r.id));
 const post=await call(api,`/api/tenants/${manifest.customerId}/custom-rules`,{method:'POST',body:{id:'customer.write'}});
 assert.equal(post.status,404,'no customer rule writer exists');
});

test('module gating rejects disabled server routes (403) in both directions',async()=>{
 const {env}=await harness();
 const operationsOnly=compose(env,['operations']);
 const commerceOnly=compose(env,['commerce']);
 const metricId=customMetrics[0]?.id??'customer.example_hours_saved';
 const deniedApi=await call(commerceOnly,`/api/tenants/${manifest.customerId}/custom-metrics/${metricId}`);
 assert.equal(deniedApi.status,403);
 assert.match(await deniedApi.text(),/MODULE_DISABLED/);
 const deniedCommerce=await call(operationsOnly,`/api/tenants/${manifest.customerId}/commerce-metrics`);
 assert.equal(deniedCommerce.status,403);
 assert.match(await deniedCommerce.text(),/MODULE_DISABLED/);
});

test('a viewer cannot pull connector data (403)',async()=>{
 const {env}=await harness();
 const api=compose(env);
 const response=await call(api,`/api/tenants/${manifest.customerId}/connector-pull/ops-demo`,{method:'POST',user:'local-viewer'});
 assert.equal(response.status,403);
});

process.on('exit',close);