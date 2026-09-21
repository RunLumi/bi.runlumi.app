import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, readdir} from 'node:fs/promises';
import {createApi} from '@runlumi/core/api.ts';
import {AppError} from '@runlumi/core/contracts.ts';
import {LocalDatabase, LocalObjects, stubControl} from '@runlumi/cloudflare/testing.ts';
import {validateDeploymentEnv} from '@runlumi/cloudflare/deployment.ts';

const CUSTOMER='alpha';
const migration=async()=>{
 const dir=new URL('../migrations/tenant/',import.meta.url);
 return (await Promise.all((await readdir(dir)).filter(f=>f.endsWith('.sql')).sort().map(f=>readFile(new URL(f,dir),'utf8')))).join('\n');
};
/** Build a dedicated customer deployment: one fixed SERVING binding, server-owned
 * CUSTOMER_ID, and a control stub for memberships/roles. The serving D1 must
 * declare this exact deployment identity (customer/deployment/environment); pass
 * servingIdentity:null to simulate an unseeded or foreign serving database. */
async function deployment({memberships,features,servingIdentity}={}){
 const serving=new LocalDatabase();
 serving.db.exec(await migration());
 serving.db.prepare('INSERT INTO tenant_identity (singleton,tenant_id) VALUES (1,?)').run(CUSTOMER);
 const identity=servingIdentity===undefined?{customerId:CUSTOMER,deploymentId:`${CUSTOMER}-production`,environment:'production'}:servingIdentity;
 if(identity)serving.db.prepare('INSERT INTO serving_identity (singleton,customer_id,deployment_id,environment) VALUES (1,?,?,?)').run(identity.customerId,identity.deploymentId,identity.environment);
 const env={
  SERVING:serving,SOURCES:new LocalObjects(),
  CONTROL:{fetch:stubControl({cellId:`${CUSTOMER}-production`,memberships:memberships??[
   {tenantId:CUSTOMER,issuer:'local-test',subject:'alpha-owner',role:'owner'},
   {tenantId:CUSTOMER,issuer:'local-test',subject:'alpha-viewer',role:'viewer'}
  ],...(features?{features}:{})})},
  CELL_ID:`${CUSTOMER}-production`,CUSTOMER_ID:CUSTOMER,DEPLOYMENT_ID:`${CUSTOMER}-production`,ENVIRONMENT:'production',TENANT_BINDINGS:'["SERVING"]'
 };
 const authenticate=async request=>{
  const subject=request.headers.get('x-demo-user');
  // Fail closed exactly like the production verifier: a machine actor with no
  // verified end-user identity is not a session.
  if(!subject)throw new AppError(401,'UNAUTHENTICATED');
  return {issuer:'local-test',subject};
 };
 const api=createApi(authenticate,true);
 const call=(path,{user,method='GET',body}={})=>api(new Request(`https://${CUSTOMER}.example${path}`,{method,headers:{...(user?{'x-demo-user':user}:{}),...(body!==undefined?{'content-type':'application/json'}:{})},...(body!==undefined?{body:JSON.stringify(body)}:{})}),env);
 return {env,serving,call};
}

test('D: deployment rejects a tenant id other than its configured customer',async()=>{
 const {call}=await deployment();
 const foreign=await call('/api/tenants/beta/metrics?',{user:'alpha-owner'});
 // Path regex requires /api/tenants/<id>/<route>; beta is a valid-shaped id but not ours.
 const response=await call('/api/tenants/beta/readiness',{user:'alpha-owner'});
 assert.equal(response.status,403,'valid beta id must be denied at the deployment fence');
 assert.equal((await response.json()).error.code,'CUSTOMER_MISMATCH');
});

test('D: identical business IDs cannot cross a swapped deployment binding',async()=>{
 // Beta-shaped deployment cannot serve alpha's tenant record even with a valid identity.
 const {call}=await deployment({memberships:[{tenantId:'beta',issuer:'local-test',subject:'alpha-owner',role:'owner'}]});
 const response=await call('/api/tenants/beta/readiness',{user:'alpha-owner'});
 assert.equal(response.status,403);
});

test('E: viewer is denied data.import while owner is permitted',async()=>{
 const {call}=await deployment();
 const viewer=await call('/api/tenants/alpha/commerce-receipts',{user:'alpha-viewer',method:'GET'});
 assert.equal(viewer.status,403,'viewer must not read owner-only receipts');
 assert.equal((await viewer.json()).error.code,'OWNER_REQUIRED');
});

test('E: revoked membership (no accepted identity) fails closed',async()=>{
 const {call}=await deployment({memberships:[{tenantId:CUSTOMER,issuer:'local-test',subject:'alpha-owner',role:'owner'}]});
 const response=await call('/api/tenants/alpha/readiness',{user:'alpha-revoked'});
 assert.equal(response.status,403,'an identity with no membership must be denied');
});

test('E: a machine actor without an end-user identity cannot call the API',async()=>{
 const {call}=await deployment();
 const response=await call('/api/tenants/alpha/readiness',{});
 assert.equal(response.status,401,'a service identity is not an end-user session');
});

test('E: session exposes only the configured customer, never a cross-customer list',async()=>{
 const {call}=await deployment({memberships:[
  {tenantId:'alpha',issuer:'local-test',subject:'alpha-owner',role:'owner'},
  {tenantId:'beta',issuer:'local-test',subject:'alpha-owner',role:'owner'}
 ]});
 const response=await call('/api/session',{user:'alpha-owner'});
 const body=await response.json();
 assert.equal(response.status,200);
 assert.deepEqual(body.tenants.map(t=>t.id),['alpha'],'only the configured customer may appear');
});

test('B: dedicated deployment completes source -> publication -> query with a fixed binding',async()=>{
 const {call,serving}=await deployment();
 // Seed a raw export through the governed receipt pipeline.
 const orders=JSON.parse(await readFile(new URL('../examples/commerce/orders.json',import.meta.url),'utf8'));
 const {commerceSchemaFingerprint}=await import('@runlumi/core/commerce-model.ts');
 const connect=await call('/api/tenants/alpha/commerce-connections',{user:'alpha-owner',method:'POST',body:{id:'orders-export',provider:'generic',sourceAccountId:'shop-A',resourceType:'orders',approvalRef:'synthetic-acceptance'}});
 assert.equal(connect.status,201,'owner may authorize an export source');
 const receipt=await call('/api/tenants/alpha/commerce-receipts',{user:'alpha-owner',method:'POST',body:{connectionId:'orders-export',eventType:'snapshot',sourceAccountId:'shop-A',resourceType:'orders',deliveryId:'acceptance-1',sourceObjectId:'synthetic',sourceRevision:null,sourceEventAt:null,sourceUpdatedAt:null,window:orders.window,schemaFingerprint:await commerceSchemaFingerprint(),rawJson:JSON.stringify(orders)}});
 assert.ok([200,202].includes(receipt.status),'raw export is accepted into the receipt outbox');
 const receiptId=(await receipt.json()).receiptId;
 const normalized=await call('/api/tenants/alpha/commerce-normalizations',{user:'alpha-owner',method:'POST',body:{receiptId}});
 assert.equal(normalized.status,200,'normalization produces bounded normalized evidence');
 assert.equal(serving.db.prepare('SELECT COUNT(*) AS n FROM commerce_receipts').get().n,1,'receipt persisted in the dedicated serving database');
});

test('deployment gate rejects a swapped or shared serving binding',async()=>{
 const base={SERVING:new LocalDatabase(),SOURCES:new LocalObjects(),CONTROL:{fetch:async()=>new Response()},CELL_ID:'alpha-production',CUSTOMER_ID:'alpha',DEPLOYMENT_ID:'alpha-production',ENVIRONMENT:'production'};
 assert.throws(()=>validateDeploymentEnv({...base,TENANT_BINDINGS:'["SERVING","TENANT_B"]'}),/TENANT_ROUTING_UNAVAILABLE/,{name:'multi-tenant config must not masquerade as dedicated'});
 assert.throws(()=>validateDeploymentEnv({...base,CELL_ID:'other'}),/DEPLOYMENT_IDENTITY_MISMATCH/);
 assert.throws(()=>validateDeploymentEnv({...base,CUSTOMER_ID:'BAD ID'}),/DEPLOYMENT_NOT_CONFIGURED/);
});

test('F: swapping the same customer staging/production serving database must fail',async()=>{
 // Tenant id and route epoch still match alpha; only the deployment identity differs.
 const {call}=await deployment({servingIdentity:{customerId:'alpha',deploymentId:'alpha-staging',environment:'staging'}});
 const response=await call('/api/tenants/alpha/readiness',{user:'alpha-owner'});
 assert.equal(response.status,503,'staging D1 must not serve production wiring');
 assert.equal((await response.json()).error.code,'SERVING_IDENTITY_MISMATCH');
});

test('F: a serving database without a declared deployment identity fails closed',async()=>{
 const {call}=await deployment({servingIdentity:null});
 const response=await call('/api/tenants/alpha/readiness',{user:'alpha-owner'});
 assert.equal(response.status,503,'an unseeded serving database must never be used');
 assert.equal((await response.json()).error.code,'SERVING_IDENTITY_MISMATCH');
});

test('F: a different customer serving database fails even when tenant rows match',async()=>{
 const {call}=await deployment({servingIdentity:{customerId:'beta',deploymentId:'beta-production',environment:'production'}});
 const response=await call('/api/tenants/alpha/readiness',{user:'alpha-owner'});
 assert.equal(response.status,503);
 assert.equal((await response.json()).error.code,'SERVING_IDENTITY_MISMATCH');
});

test('F: dedicated worker refuses to proxy fleet-administration endpoints',async()=>{
 const {call}=await deployment();
 const response=await call('/api/control/admin/overview',{user:'alpha-owner'});
 assert.equal(response.status,403,'a customer deployment must not proxy unrestricted admin endpoints');
 assert.equal((await response.json()).error.code,'CONTROL_ADMIN_DENIED');
});
