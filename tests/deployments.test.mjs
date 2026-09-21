// Deployment registration and control-authentication matrix (PR2 findings d/f).
// Server-owned registry rows are the authority; the x-lumi-deployment header is a
// bounded locator. Cross-deployment, cross-customer, suspended, retired, version
// mismatch, cell-scope and admin-endpoint cases all fail closed.
import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,readdir,writeFile,mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import path from 'node:path';
import {verifyRegisteredAccess} from '@runlumi/cloudflare/auth.ts';
import {LUMI_CONTROL_API} from '@runlumi/core/version.ts';
import {LocalDatabase,LocalObjects} from '@runlumi/cloudflare/testing.ts';
import {createControl} from '../apps/control/src/service.ts';
import {generateCustomer} from '../scripts/customer-new.mjs';

// ---- Real Access-style RS256 JWTs, one keypair per team ----
const teams=['alpha-team','beta-team','cell-team'];
const pairs=Object.fromEntries(await Promise.all(teams.map(async team=>{
 const key=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 return [team,{key,publicKey:{...await crypto.subtle.exportKey('jwk',key.publicKey),kid:'k1',alg:'RS256',use:'sig'}}];
})));
const encode=x=>Buffer.from(typeof x==='string'?x:JSON.stringify(x)).toString('base64url');
const now=2000000000;
async function mint(team,aud,sub,claims={}){
 const input=`${encode({alg:'RS256',kid:'k1'})}.${encode({iss:`https://${team}.cloudflareaccess.com`,sub,aud:[aud],exp:now+3600,iat:now,...claims})}`;
 const sig=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',pairs[team].key.privateKey,new TextEncoder().encode(input));
 return `${input}.${Buffer.from(sig).toString('base64url')}`;
}
const jwks=async url=>{
 const team=url.match(/^https:\/\/([a-z0-9-]+)\.cloudflareaccess\.com\/cdn-cgi\/access\/certs$/)?.[1];
 assert.ok(team&&pairs[team],`JWKS request escaped the registered teams: ${url}`);
 return Response.json({keys:[pairs[team].publicKey]});
};
// ---- Control database: tenants, memberships, operators and registered deployments ----
const AUDA='a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1a1';
const AUDS='s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1s1';
const AUDB='b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1b1';
const AUDCELL='c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1';
async function controlDb(){
 const db=new LocalDatabase();
 for(const file of ['0001_initial.sql','0002_control_plane.sql','0003_release_safety.sql','0004_tenant_lifecycle.sql','0005_deployments.sql']){
  db.db.exec(await readFile(new URL(`../migrations/control/${file}`,import.meta.url),'utf8'));
 }
 db.db.exec(`
  INSERT INTO tenants (id,name,binding_name,cell_id,state) VALUES
   ('alpha','Alpha','TENANT_ALPHA','cell-1','active'),('beta','Beta','TENANT_BETA','cell-1','active');
  INSERT INTO tenant_lifecycle (tenant_id,state,revision,reason,updated_at) VALUES
   ('alpha','ACTIVE',1,'seed',CURRENT_TIMESTAMP),('beta','ACTIVE',1,'seed',CURRENT_TIMESTAMP);
  INSERT INTO users (issuer,subject,state) VALUES
   ('https://alpha-team.cloudflareaccess.com','op-1','active'),
   ('https://alpha-team.cloudflareaccess.com','alpha-owner','active'),
   ('https://beta-team.cloudflareaccess.com','beta-owner','active'),
   ('https://cell-team.cloudflareaccess.com','cell-owner','active');
  INSERT INTO memberships (tenant_id,issuer,subject,role,state) VALUES
   ('alpha','https://alpha-team.cloudflareaccess.com','alpha-owner','owner','active'),
   ('alpha','https://alpha-team.cloudflareaccess.com','op-1','owner','active'),
   ('beta','https://beta-team.cloudflareaccess.com','beta-owner','owner','active');
  INSERT INTO platform_operators (issuer,subject) VALUES ('https://alpha-team.cloudflareaccess.com','op-1');
  INSERT INTO deployments (deployment_id,customer_id,environment,hostname,access_team,access_aud,control_api_version,resource_inventory,state,updated_at) VALUES
   ('alpha-production','alpha','production','alpha-production.bi.runlumi.app','alpha-team','${AUDA}',1,'{"type":"dedicated"}','registered',CURRENT_TIMESTAMP),
   ('alpha-staging','alpha','staging','alpha-staging.bi.runlumi.app','alpha-team','${AUDS}',1,'{"type":"dedicated"}','suspended',CURRENT_TIMESTAMP),
   ('beta-production','beta','production','beta-production.bi.runlumi.app','beta-team','${AUDB}',1,'{"type":"dedicated"}','registered',CURRENT_TIMESTAMP),
   ('cell-1',NULL,NULL,'cell.bi.runlumi.app','cell-team','${AUDCELL}',1,'{"type":"cell"}','registered',CURRENT_TIMESTAMP);
 `);
 return db;
}
const regRequest=(deploymentId,api,jwt)=>new Request('https://control.invalid/control/session',{headers:{
 ...(deploymentId?{'x-lumi-deployment':deploymentId}:{}),
 ...(api?{'x-lumi-control-api':api}:{}),
 ...(jwt?{'cf-access-jwt-assertion':jwt}:{})
}});
const db=await controlDb();

test('registry: a registered A-production token verifies to its principal',async()=>{
 const p=await verifyRegisteredAccess(db,regRequest('alpha-production',String(LUMI_CONTROL_API),await mint('alpha-team',AUDA,'alpha-owner')),jwks,now);
 assert.deepEqual(p,{issuer:'https://alpha-team.cloudflareaccess.com',subject:'alpha-owner'});
});
test('registry: the same cell scope verifies through its own team and audience',async()=>{
 const p=await verifyRegisteredAccess(db,regRequest('cell-1',String(LUMI_CONTROL_API),await mint('cell-team',AUDCELL,'cell-owner')),jwks,now);
 assert.equal(p.subject,'cell-owner');
});
for(const[deployment,team,aud,label]of[['alpha-production','alpha-team',AUDS,'A-staging token presented to A-production'],['alpha-production','beta-team',AUDB,'B token presented to A-production']]){
 test(`registry: ${label} must fail closed`,async()=>{
  await assert.rejects(async()=>verifyRegisteredAccess(db,regRequest(deployment,String(LUMI_CONTROL_API),await mint(team,aud,'attacker')),jwks,now),error=>error.code==='UNAUTHENTICATED');
 });
}
test('registry: an unregistered deployment is not configurable, not a fallback',async()=>{
 await assert.rejects(async()=>verifyRegisteredAccess(db,regRequest('alpha-acme-takeover',String(LUMI_CONTROL_API),await mint('alpha-team',AUDA,'alpha-owner')),jwks,now),error=>error.code==='AUTH_NOT_CONFIGURED');
});
test('registry: a suspended deployment denies even a valid token',async()=>{
 await assert.rejects(async()=>verifyRegisteredAccess(db,regRequest('alpha-staging',String(LUMI_CONTROL_API),await mint('alpha-team',AUDS,'alpha-owner')),jwks,now),error=>error.code==='DEPLOYMENT_INACTIVE');
});
test('registry: a control interface version mismatch fails closed with a conflict',async()=>{
 await assert.rejects(async()=>verifyRegisteredAccess(db,regRequest('alpha-production','2',await mint('alpha-team',AUDA,'alpha-owner')),jwks,now),error=>error.code==='CONTROL_API_MISMATCH');
});
test('registry: a missing deployment locator and a missing JWT fail closed',async()=>{
 await assert.rejects(async()=>verifyRegisteredAccess(db,regRequest(undefined,undefined,await mint('alpha-team',AUDA,'alpha-owner')),jwks,now));
 await assert.rejects(async()=>verifyRegisteredAccess(db,regRequest('alpha-production',String(LUMI_CONTROL_API),undefined),jwks,now));
});

// ---- Control admin endpoints: server-owned registration and lifecycle ----
const op={issuer:'https://alpha-team.cloudflareaccess.com',subject:'op-1'};
const control=createControl(async()=>op);
const env={CONTROL_DB:db,PACKS:new LocalObjects()};
const send=async(path,method='GET',body)=>control(new Request(`https://control.invalid${path}`,{method,body:body?JSON.stringify(body):undefined,headers:body?{'content-type':'application/json'}:{}}),env);
const register=(customerId,environment,overrides={})=>send('/control/admin/deployments','POST',{
 deploymentId:`${customerId}-${environment}`,customerId,environment,
 hostname:`${customerId}-${environment}.reviewed.example.biz`,accessTeam:'alpha-team',accessAud:AUDA,controlApiVersion:LUMI_CONTROL_API,resourceInventory:{type:'dedicated'},...overrides
});

test('admin: an operator registers customer deployments; duplicates and scope rows are rejected',async()=>{
 const r=await register('alpha','preview');assert.equal(r.status,200);assert.deepEqual((await r.json()).state,'registered');
 const dup=await register('alpha','preview');assert.equal(dup.status,409);assert.equal((await dup.json()).error.code,'DEPLOYMENT_EXISTS');
 const cell=await send('/control/admin/deployments','POST',{deploymentId:'cell-9',hostname:'cell.biz',accessTeam:'a-team',accessAud:AUDA,controlApiVersion:1,resourceInventory:{}});
 assert.equal(cell.status,422);assert.equal((await cell.json()).error.code,'CUSTOMER_REQUIRED');
 const unknown=await register('nobody','production');assert.equal(unknown.status,404);
});
test('admin: placeholder and invalid deployment inputs fail closed',async()=>{
 for(const overrides of [
  {accessTeam:'replace-access-team'},{accessTeam:'acme-example'},
  {accessAud:'a'.repeat(64)},{accessAud:'short'},
  {controlApiVersion:2},{environment:'sandbox'},
  {hostname:'alpha-preview.workers.dev'},{hostname:'alpha-preview.example.com'},
  {resourceInventory:null}
 ]){
  const r=await register('alpha','production',overrides);
  assert.equal(r.status,422,`expected 422 for ${JSON.stringify(overrides)}`);
 }
 const missing=await send('/control/admin/deployments','POST',{deploymentId:'alpha-prod',customerId:'alpha',hostname:'x.biz',accessTeam:'alpha-team',accessAud:AUDA,controlApiVersion:1,resourceInventory:{}});
 assert.equal(missing.status,422);assert.equal((await missing.json()).error.code,'INVALID_ENVIRONMENT');
});
test('admin: deployments list returns every registered scope including the cell row',async()=>{
 const r=await send('/control/admin/deployments');assert.equal(r.status,200);
 const body=await r.json();
 const ids=body.deployments.map(d=>d.deployment_id);
 for(const expected of ['alpha-production','alpha-staging','beta-production','cell-1','alpha-preview'])assert.ok(ids.includes(expected),`missing ${expected}`);
 const cell=body.deployments.find(d=>d.deployment_id==='cell-1');
 assert.equal(cell.customer_id,null);assert.equal(cell.environment,null);assert.equal(cell.control_api_version,1);
});
test('admin: deployment lifecycle transitions are audited and grow only over reviewed states',async()=>{
 let r=await send('/control/admin/deployments/alpha-preview/state','PUT',{state:'suspended',reason:'maintenance'});
 assert.equal(r.status,200);assert.equal((await r.json()).state,'suspended');
 r=await send('/control/admin/deployments/alpha-preview/state','PUT',{state:'registered',reason:'resume'});
 assert.equal(r.status,200);
 r=await send('/control/admin/deployments/alpha-preview/state','PUT',{state:'retired',reason:'decommissioned'});
 assert.equal(r.status,200);
 r=await send('/control/admin/deployments/alpha-preview/state','PUT',{state:'registered',reason:'resurrect'});
 assert.equal(r.status,409);assert.equal((await r.json()).error.code,'DEPLOYMENT_TRANSITION_INVALID');
 r=await send('/control/admin/deployments/alpha-preview/state','PUT',{state:'retired',reason:'again'});
 assert.equal(r.status,422);
 r=await send('/control/admin/deployments/does-not-exist/state','PUT',{state:'suspended',reason:'x'});
 assert.equal(r.status,404);
});
test('admin: only a platform operator reaches fleet endpoints; session is tenant-scoped',async()=>{
 const controlOwner=createControl(async()=>({issuer:'https://alpha-team.cloudflareaccess.com',subject:'alpha-owner'}));
 const denied=await controlOwner(new Request('https://control.invalid/control/admin/overview'),env);
 assert.equal(denied.status,403);assert.equal((await denied.json()).error.code,'PLATFORM_OPERATOR_REQUIRED');
 const session=await controlOwner(new Request('https://control.invalid/control/session'),env);
 assert.equal(session.status,200);
 const body=await session.json();
 assert.deepEqual(body.tenants.map(t=>t.id),['alpha'],'an owner sees only their own tenant');
 assert.equal(body.platformOperator,false);
});
test('admin: the control entry wires the registry verifier end to end',async()=>{
 // Mirrors apps/control/src/index.ts: this is the production fetch pipeline.
 const entry=createControl(async(request,env)=>verifyRegisteredAccess(env.CONTROL_DB,request,jwks,now));
 const ok=await entry(new Request('https://control.invalid/control/session',{headers:{'x-lumi-deployment':'alpha-production','x-lumi-control-api':String(LUMI_CONTROL_API),'cf-access-jwt-assertion':await mint('alpha-team',AUDA,'alpha-owner')}}),env);
 assert.equal(ok.status,200);
 const bad=await entry(new Request('https://control.invalid/control/session',{headers:{'x-lumi-deployment':'beta-production','x-lumi-control-api':String(LUMI_CONTROL_API),'cf-access-jwt-assertion':await mint('alpha-team',AUDA,'alpha-owner')}}),env);
 assert.equal(bad.status,401);assert.equal((await bad.json()).error.code,'UNAUTHENTICATED');
});
test('registry: a B customer deployment claiming an A identity fails even with the A session',async()=>{
 await assert.rejects(async()=>verifyRegisteredAccess(db,regRequest('beta-production',String(LUMI_CONTROL_API),await mint('alpha-team',AUDA,'alpha-owner')),jwks,now),error=>error.code==='UNAUTHENTICATED');
});

// ---- Generation: distinct per-environment deployment identity ----
const fakeDir=await mkdtemp(path.join(tmpdir(),'lumi-artifacts-'));
const genDest=await mkdtemp(path.join(tmpdir(),'lumi-gen-'));
try{
 const manifest={schemaVersion:2,release:'0.1.0',templateVersion:3,sourceCommit:'deadbeef0123456789',packages:{
  '@runlumi/core':{file:'runlumi-core-0.1.0.tgz',sha256:'a'.repeat(64)},
  '@runlumi/cloudflare':{file:'runlumi-cloudflare-0.1.0.tgz',sha256:'b'.repeat(64)},
  '@runlumi/ui':{file:'runlumi-ui-0.1.0.tgz',sha256:'c'.repeat(64)}
 }};
 await writeFile(path.join(fakeDir,'lumi-core-manifest.json'),JSON.stringify(manifest,null,2));
 for(const p of Object.values(manifest.packages))await writeFile(path.join(fakeDir,p.file),'stub');
 const {inventories}=await generateCustomer({customerId:'alpha',envs:['production','staging'],dest:genDest,artifactsDir:fakeDir});
 const[prod,staging]=inventories;
 test('generation: every environment owns distinct resources and identity',()=>{
  for(const key of ['workerName','hostname','databaseName','databaseId','sourcesBucket','accessAudience','deploymentId']){
   const a=key==='databaseName'?prod.servingDatabase.databaseName:key==='databaseId'?prod.servingDatabase.databaseId:prod[key];
   const b=key==='databaseName'?staging.servingDatabase.databaseName:key==='databaseId'?staging.servingDatabase.databaseId:staging[key];
   assert.notEqual(a,b,`${key} must differ between production and staging`);
  }
  assert.equal(prod.accessTeam,'replace-access-team');assert.equal(staging.hostnameReviewed,false);
  assert.equal(prod.deploymentId,'alpha-production');assert.equal(staging.deploymentId,'alpha-staging');
 });
 test('generation: lock is customer-level with fresh migration baselines',async()=>{
  const lock=JSON.parse(await readFile(path.join(genDest,'lumi.lock.json'),'utf8'));
  assert.equal(lock.deploymentId,undefined);assert.equal(lock.environment,undefined);
  assert.equal(lock.customerId,'alpha');
  assert.equal(lock.core.migrations.controlBaseline,5);assert.equal(lock.core.migrations.tenantBaseline,11);
 });
 test('generation: wrangler production base plus per-env sections match the inventories',async()=>{
  const wrangler=JSON.parse(await readFile(path.join(genDest,'apps/worker/wrangler.jsonc'),'utf8'));
  assert.equal(wrangler.name,prod.workerName);
  assert.equal(wrangler.vars.DEPLOYMENT_ID,'alpha-production');assert.equal(wrangler.vars.ACCESS_TEAM,'replace-access-team');
  assert.equal(wrangler.d1_databases[0].migrations_dir,'../../customer/migrations');
  const section=wrangler.env.staging;
  assert.equal(section.name,staging.workerName);
  assert.equal(section.vars.DEPLOYMENT_ID,'alpha-staging');assert.equal(section.vars.ACCESS_AUD,staging.accessAudience);
  assert.equal(section.d1_databases[0].database_name,staging.servingDatabase.databaseName);
  assert.equal(section.r2_buckets[0].bucket_name,staging.sourcesBucket);
  assert.equal(section.routes[0].pattern,staging.hostname);
  assert.equal((await readdir(path.join(genDest,'infra/environments'))).sort().join(','),'production.json,staging.json');
 });
}finally{
 await rm(fakeDir,{recursive:true,force:true});await rm(genDest,{recursive:true,force:true});
}
