import {AppError,id,integer,object,text,sha256,type Principal,type Role} from '@runlumi/core/contracts.ts';
import {features,effectiveFeatures,requireFeature,parseLicense,type Feature,type License} from '@runlumi/core/licensing.ts';
import {parseTenantPack,type ActivePack,type TenantPack} from '@runlumi/core/tenant-pack.ts';
import {readJson,json,revision} from '@runlumi/core/http.ts';
import {LUMI_CONTROL_API} from '@runlumi/core/version.ts';
import type {Database} from '@runlumi/core/ports.ts';
import type {ControlEnv} from './control-bindings.ts';
type Auth=(request:Request,env:ControlEnv)=>Promise<Principal>;
type Member={id:string;name:string;binding_name:string;cell_id:string;route_epoch:number;role:Role};
type LifecycleState='PROVISIONING'|'VALIDATING'|'ACTIVE'|'SUSPENDED'|'EXPORT_PENDING'|'DELETING'|'DELETED'|'FAILED';
const lifecycleStates:readonly LifecycleState[]=['PROVISIONING','VALIDATING','ACTIVE','SUSPENDED','EXPORT_PENDING','DELETING','DELETED','FAILED'];
const lifecycleTransitions:Record<LifecycleState,readonly LifecycleState[]>={
 PROVISIONING:['VALIDATING','FAILED','DELETING'],VALIDATING:['ACTIVE','FAILED','PROVISIONING','DELETING'],
 ACTIVE:['SUSPENDED','EXPORT_PENDING','DELETING'],SUSPENDED:['ACTIVE','EXPORT_PENDING','DELETING'],
 EXPORT_PENDING:['ACTIVE','DELETING'],DELETING:['DELETED','FAILED'],FAILED:['PROVISIONING','DELETING'],DELETED:[]
};
function canTransition(from:LifecycleState,to:LifecycleState):boolean{return from===to||lifecycleTransitions[from].includes(to);}
function primary(db:Database):Database{return db.withSession?db.withSession('first-primary'):db;}
async function licenseFor(db:Database,tenant:string){return db.prepare('SELECT plan_id,state,starts_at,ends_at,grace_ends_at,features,revision FROM licenses WHERE tenant_id=?').bind(tenant).first<License>();}
async function membership(db:Database,p:Principal,tenant:string):Promise<Member>{
  const r=await db.prepare("SELECT t.id,t.name,t.binding_name,t.cell_id,t.route_epoch,m.role FROM tenants t JOIN tenant_lifecycle l ON l.tenant_id=t.id AND l.state='ACTIVE' JOIN memberships m ON m.tenant_id=t.id JOIN users u ON u.issuer=m.issuer AND u.subject=m.subject WHERE t.id=? AND t.state='active' AND m.state='active' AND u.state='active' AND m.issuer=? AND m.subject=?")
    .bind(tenant,p.issuer,p.subject).first<Member>();
  if(!r||!['viewer','editor','owner'].includes(r.role))throw new AppError(403,'TENANT_ACCESS_DENIED');return r;
}
async function operator(db:Database,p:Principal):Promise<void>{const r=await db.prepare("SELECT 1 AS ok FROM platform_operators o JOIN users u ON u.issuer=o.issuer AND u.subject=o.subject WHERE o.issuer=? AND o.subject=? AND u.state='active'").bind(p.issuer,p.subject).first();if(!r)throw new AppError(403,'PLATFORM_OPERATOR_REQUIRED');}
async function validateAIProfile(db:Database,tenant:string,pack:TenantPack):Promise<void>{
  // Disabled profiles never resolve or use these inert references.
  if(!pack.ai.enabled)return;
  const grant=await db.prepare("SELECT 1 AS ok FROM tenant_ai_profiles WHERE tenant_id=? AND provider_instance_ref=? AND model_ref=? AND credential_ref=? AND state='active'")
    .bind(tenant,pack.ai.providerInstanceRef,pack.ai.modelRef,pack.ai.credentialRef).first();
  if(!grant)throw new AppError(403,'AI_PROFILE_REFERENCE_DENIED');
}
async function activePack(db:Database,env:ControlEnv,tenant:string):Promise<ActivePack|null>{
  const r=await db.prepare('SELECT d.active_release_id,r.release_id,r.content_hash,r.object_key,r.source_commit,d.revision FROM tenant_deployments d LEFT JOIN tenant_releases r ON r.tenant_id=d.tenant_id AND r.release_id=d.active_release_id WHERE d.tenant_id=?').bind(tenant).first<{active_release_id:string|null;release_id:string|null;content_hash:string;object_key:string;source_commit:string;revision:number}>();
  if(!r||r.active_release_id===null)return null;
  if(!r.release_id)throw new AppError(503,'PACK_UNAVAILABLE');
  if(r.object_key!==`tenants/${tenant}/packs/${r.content_hash}.json`)throw new AppError(503,'PACK_IDENTITY_MISMATCH');
  const obj=await env.PACKS.get(r.object_key);if(!obj)throw new AppError(503,'PACK_UNAVAILABLE');if(obj.size!==undefined&&obj.size>48_000)throw new AppError(503,'PACK_INTEGRITY');
  const body=await obj.text();if(new TextEncoder().encode(body).byteLength>48_000||await sha256(body)!==r.content_hash)throw new AppError(503,'PACK_INTEGRITY');
  const pack=parseTenantPack(JSON.parse(body));await validateAIProfile(db,tenant,pack);
  return {releaseId:r.release_id,revision:r.revision,sourceCommit:r.source_commit,provenance:'operator-asserted',attestationVerified:false,pack};
}
export function createControl(authenticate:Auth,clock:()=>number=Date.now){
 return async(request:Request,env:ControlEnv):Promise<Response>=>{
  try{
   const url=new URL(request.url);if(!url.pathname.startsWith('/control/'))throw new AppError(404,'NOT_FOUND');
   if(!['GET','POST','PUT'].includes(request.method))throw new AppError(405,'METHOD_NOT_ALLOWED');
   const p=await authenticate(request,env);const db=primary(env.CONTROL_DB);const now=new Date(clock()).toISOString();
   if(url.pathname==='/control/session'&&request.method==='GET'){
    const rows=await db.prepare("SELECT t.id,t.name,t.cell_id,m.role FROM tenants t JOIN tenant_lifecycle l ON l.tenant_id=t.id AND l.state='ACTIVE' JOIN memberships m ON m.tenant_id=t.id JOIN users u ON u.issuer=m.issuer AND u.subject=m.subject WHERE t.state='active' AND m.state='active' AND u.state='active' AND m.issuer=? AND m.subject=? ORDER BY t.id LIMIT 100").bind(p.issuer,p.subject).all();
    const tenants=[];for(const r of rows.results){const l=await licenseFor(db,String(r.id));tenants.push({...r,license:l?{plan:l.plan_id,state:l.state,endsAt:l.ends_at,revision:l.revision}:null,features:effectiveFeatures(l,clock())});}
    let isOperator=false;try{await operator(db,p);isOperator=true;}catch{}
    return json({tenants,platformOperator:isOperator});
   }
   if(url.pathname==='/control/authorize'&&request.method==='POST'){
    const b=object(await readJson(request),['tenantId','cellId','feature']);const tenant=id(b.tenantId);const row=await membership(db,p,tenant);
    if(!features.includes(b.feature as Feature))throw new AppError(403,'CAPABILITY_DENIED');
    if(row.cell_id!==b.cellId)throw new AppError(503,'TENANT_ROUTING_UNAVAILABLE');
    if(b.feature==='dashboard.edit'&&row.role==='viewer')throw new AppError(403,'EDITOR_REQUIRED');
    if(b.feature==='data.import'&&row.role!=='owner')throw new AppError(403,'OWNER_REQUIRED');
    const l=await licenseFor(db,tenant);requireFeature(l,b.feature as Feature,clock());
    return json({...row,features:effectiveFeatures(l,clock()),license:l?{plan:l.plan_id,state:l.state,endsAt:l.ends_at,revision:l.revision}:null,active:await activePack(db,env,tenant)});
   }
   await operator(db,p); // A tenant owner is never implicitly a platform operator.
   if(url.pathname==='/control/admin/overview'&&request.method==='GET'){
    const t=await db.prepare('SELECT t.id,t.name,t.cell_id,t.route_epoch,t.state,lifecycle.state AS lifecycle_state,lifecycle.revision AS lifecycle_revision,l.plan_id,l.state AS license_state,l.ends_at,l.revision AS license_revision,d.active_release_id,d.revision AS config_revision FROM tenants t JOIN tenant_lifecycle lifecycle ON lifecycle.tenant_id=t.id LEFT JOIN licenses l ON l.tenant_id=t.id LEFT JOIN tenant_deployments d ON d.tenant_id=t.id ORDER BY t.id LIMIT 100').all();
    const u=await db.prepare('SELECT u.issuer,u.subject,u.state,COUNT(m.tenant_id) AS tenant_count FROM users u LEFT JOIN memberships m ON m.issuer=u.issuer AND m.subject=u.subject AND m.state=\'active\' GROUP BY u.issuer,u.subject,u.state ORDER BY u.subject LIMIT 100').all();
    return json({tenants:t.results,users:u.results,limit:100,note:'Control metadata only. Operator role does not grant tenant-data access.'});
   }
   if(url.pathname==='/control/admin/deployments'&&request.method==='GET'){
    const rows=await db.prepare('SELECT d.deployment_id,d.customer_id,d.environment,d.hostname,d.access_team,d.access_aud,d.control_api_version,d.resource_inventory,d.state,d.updated_at,t.name AS customer_name FROM deployments d LEFT JOIN tenants t ON t.id=d.customer_id ORDER BY d.deployment_id LIMIT 200').all();
    return json({deployments:rows.results});
   }
   if(url.pathname==='/control/admin/deployments'&&request.method==='POST'){
    const b=object(await readJson(request),['deploymentId','customerId','environment','hostname','accessTeam','accessAud','controlApiVersion','resourceInventory']);
    const deploymentId=String(b.deploymentId);
    if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(deploymentId))throw new AppError(400,'INVALID_DEPLOYMENT_ID');
    // Customer-scoped deployments only: shared cell scopes are reviewed bootstrap
    // SQL through compileCell (control-bootstrap.sql), never a runtime endpoint.
    if(!b.customerId)throw new AppError(422,'CUSTOMER_REQUIRED');
    const customerId=id(b.customerId);if(!(await db.prepare('SELECT 1 AS ok FROM tenants WHERE id=?').bind(customerId).first()))throw new AppError(404,'TENANT_NOT_FOUND');
    const environment=String(b.environment??'');if(!['production','staging','preview'].includes(environment))throw new AppError(422,'INVALID_ENVIRONMENT');
    const hostname=text(b.hostname,253);if(!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/.test(hostname)||hostname.endsWith('.example.com')||hostname.endsWith('.workers.dev'))throw new AppError(422,'INVALID_HOSTNAME');
    const accessTeam=text(b.accessTeam,63);if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(accessTeam)||/REPLACE|example/i.test(accessTeam))throw new AppError(422,'INVALID_ACCESS_TEAM');
    const accessAud=text(b.accessAud,128);if(!/^[A-Za-z0-9_-]{20,128}$/.test(accessAud)||/^(.)\1{19,}$/.test(accessAud)||/REPLACE|example/i.test(accessAud))throw new AppError(422,'INVALID_ACCESS_AUD');
    const controlApiVersion=integer(b.controlApiVersion);if(controlApiVersion!==LUMI_CONTROL_API)throw new AppError(422,'UNSUPPORTED_CONTROL_API');
    if(!b.resourceInventory||typeof b.resourceInventory!=='object'||Array.isArray(b.resourceInventory))throw new AppError(422,'INVALID_RESOURCE_INVENTORY');
    // Cell-scope rows carry NULL customer_id/environment: the unique customer index
    // does not constrain them, so the deployment_id primary key is their collision gate.
    const existing=await db.prepare('SELECT deployment_id FROM deployments WHERE deployment_id=? OR (customer_id=? AND environment=?)').bind(deploymentId,customerId,environment).first();
    if(existing)throw new AppError(409,'DEPLOYMENT_EXISTS');
    const now=new Date(clock()).toISOString();
    await db.batch([
     db.prepare('INSERT INTO deployments (deployment_id,customer_id,environment,hostname,access_team,access_aud,control_api_version,resource_inventory,state,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(deploymentId,customerId||null,environment||null,hostname,accessTeam,accessAud,controlApiVersion,JSON.stringify(b.resourceInventory),'registered',now),
     db.prepare('INSERT INTO control_audit SELECT ?,?,?,?,?,?,?,?').bind(crypto.randomUUID(),customerId||deploymentId,p.issuer,p.subject,'deployment.registered',deploymentId,hostname,now)
    ]);
    return json({deploymentId,customerId:customerId||null,environment:environment||null,hostname,state:'registered'});
   }
   const deploymentRoute=/^\/control\/admin\/deployments\/([a-z0-9-]{1,64})\/state$/.exec(url.pathname);
   if(deploymentRoute&&request.method==='PUT'){
    const deploymentId=id(deploymentRoute[1]);
    const current=await db.prepare('SELECT state,customer_id FROM deployments WHERE deployment_id=?').bind(deploymentId).first<{state:string;customer_id:string|null}>();
    if(!current)throw new AppError(404,'NOT_FOUND');
    // Lifecycle changes are audited against the owning tenant, so only customer-scoped
    // deployments transition here; shared cell scopes move through reviewed bootstrap SQL.
    if(!current.customer_id)throw new AppError(422,'CELL_SCOPE_BOOTSTRAP_ONLY');
    const b=object(await readJson(request),['state','reason']);const state=String(b.state);const reason=text(b.reason,200);
    if(!['registered','suspended','retired'].includes(state)||state===current.state)throw new AppError(422,'INVALID_DEPLOYMENT_STATE');
    const allowed=state==='retired'?current.state!=='retired':(current.state==='registered'||current.state==='suspended')&&(state==='registered'||state==='suspended');
    if(!allowed)throw new AppError(409,'DEPLOYMENT_TRANSITION_INVALID');
    const now=new Date(clock()).toISOString();
    const result=await db.batch([
     db.prepare("UPDATE deployments SET state=?,updated_at=? WHERE deployment_id=? AND state=?").bind(state,now,deploymentId,current.state),
     db.prepare('INSERT INTO control_audit SELECT ?,?,?,?,?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),current.customer_id,p.issuer,p.subject,'deployment.state',deploymentId,reason,now)
    ]);
    if(result[0]?.meta.changes!==1)throw new AppError(409,'DEPLOYMENT_STATE_CONFLICT');return json({deploymentId,state});
   }
   const route=/^\/control\/admin\/tenants\/([a-z0-9_-]{1,64})\/(license|lifecycle|releases|activation)$/.exec(url.pathname);
   if(!route)throw new AppError(404,'NOT_FOUND');const tenant=id(route[1]);
   const tenantRow=await db.prepare('SELECT t.id,t.state,t.route_epoch,l.state AS lifecycle_state,l.revision AS lifecycle_revision FROM tenants t JOIN tenant_lifecycle l ON l.tenant_id=t.id WHERE t.id=?').bind(tenant).first<{id:string;state:string;route_epoch:number;lifecycle_state:LifecycleState;lifecycle_revision:number}>();
   if(!tenantRow)throw new AppError(404,'NOT_FOUND');
   if(route[2]!=='license'&&route[2]!=='lifecycle'&&(tenantRow.state!=='active'||tenantRow.lifecycle_state!=='ACTIVE'))throw new AppError(403,'TENANT_INACTIVE');
   if(route[2]==='lifecycle'&&request.method==='PUT'){
    const b=object(await readJson(request),['state','reason']);const state=String(b.state) as LifecycleState;const reason=text(b.reason,200);if(!lifecycleStates.includes(state))throw new AppError(422,'INVALID_TENANT_LIFECYCLE');
    if(!canTransition(tenantRow.lifecycle_state,state))throw new AppError(409,'LIFECYCLE_TRANSITION_INVALID');const expected=revision(request),now=new Date(clock()).toISOString();
    const legacyState=state==='ACTIVE'||state==='PROVISIONING'||state==='VALIDATING'?'active':'suspended';
    const result=await db.batch([
     db.prepare('UPDATE tenant_lifecycle SET state=?,revision=revision+1,reason=?,updated_at=? WHERE tenant_id=? AND revision=?').bind(state,reason,now,tenant,expected),
     db.prepare('UPDATE tenants SET state=? WHERE id=? AND EXISTS (SELECT 1 FROM tenant_lifecycle WHERE tenant_id=? AND revision=? AND state=?)').bind(legacyState,tenant,tenant,expected+1,state),
     db.prepare('INSERT INTO control_audit SELECT ?,?,?,?,?,?,?,? WHERE changes()>0').bind(crypto.randomUUID(),tenant,p.issuer,p.subject,'tenant.lifecycle',tenant,reason,now)
    ]);
    if(result[0]?.meta.changes!==1||result[1]?.meta.changes!==1)throw new AppError(409,'LIFECYCLE_REVISION_CONFLICT');return json({tenantId:tenant,state,revision:expected+1,reason});
   }
   if(route[2]==='license'&&request.method==='PUT'){
    const b=object(await readJson(request),['license','reason']);const l=parseLicense(b.license);const reason=text(b.reason,200);const expected=revision(request);
    const current=await licenseFor(db,tenant);if(!current)throw new AppError(409,'PROVISION_LICENSE_FIRST');
    const result=await db.batch([
     db.prepare('UPDATE licenses SET plan_id=?,state=?,starts_at=?,ends_at=?,grace_ends_at=?,features=?,revision=revision+1,updated_at=? WHERE tenant_id=? AND revision=?').bind(l.plan_id,l.state,l.starts_at,l.ends_at,l.grace_ends_at,l.features,now,tenant,expected),
     db.prepare('INSERT INTO control_audit SELECT ?,?,?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),tenant,p.issuer,p.subject,'license.updated',tenant,reason,now)
    ]);if(result[0]?.meta.changes!==1)throw new AppError(409,'REVISION_CONFLICT');return json({revision:expected+1});
   }
   const license=await licenseFor(db,tenant);requireFeature(license,'git.publish',clock());
   if(route[2]==='releases'&&request.method==='GET')return json({releases:(await db.prepare('SELECT release_id,source_commit,created_at FROM tenant_releases WHERE tenant_id=? ORDER BY created_at DESC LIMIT 50').bind(tenant).all()).results});
   if(route[2]==='releases'&&request.method==='POST'){
    const b=object(await readJson(request),['repository','sourcePath','sourceCommit','pack']);
    const source=await db.prepare('SELECT repository,source_path FROM pack_sources WHERE tenant_id=?').bind(tenant).first<{repository:string;source_path:string}>();
    if(!source||source.repository!==b.repository||source.source_path!==b.sourcePath)throw new AppError(403,'PACK_SOURCE_DENIED');
    if(typeof b.sourceCommit!=='string'||!/^[a-f0-9]{40}$/.test(b.sourceCommit))throw new AppError(400,'INVALID_COMMIT');
    const pack=parseTenantPack(b.pack);await validateAIProfile(db,tenant,pack);const content=JSON.stringify(pack);const hash=await sha256(content);const release=`r_${(await sha256(b.sourceCommit+hash)).slice(0,32)}`;const key=`tenants/${tenant}/packs/${hash}.json`;
    const prior=await db.prepare('SELECT release_id,content_hash FROM tenant_releases WHERE tenant_id=? AND source_commit=?').bind(tenant,b.sourceCommit).first<{release_id:string;content_hash:string}>();
    if(prior){if(prior.content_hash!==hash)throw new AppError(409,'IMMUTABLE_RELEASE_CONFLICT');return json({releaseId:prior.release_id,replayed:true});}
    await env.PACKS.put(key,content,{httpMetadata:{contentType:'application/json'}});
    await db.batch([
     db.prepare('INSERT INTO tenant_releases VALUES (?,?,?,?,?,?) ON CONFLICT(tenant_id,source_commit) DO NOTHING').bind(tenant,release,hash,key,b.sourceCommit,now),
     db.prepare('INSERT INTO control_audit SELECT ?,?,?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),tenant,p.issuer,p.subject,'pack.registered',release,'Reviewed source bundle',now)
    ]);
    const winner=await db.prepare('SELECT content_hash FROM tenant_releases WHERE tenant_id=? AND source_commit=?').bind(tenant,b.sourceCommit).first<{content_hash:string}>();
    if(winner?.content_hash!==hash)throw new AppError(409,'IMMUTABLE_RELEASE_CONFLICT');
    return json({releaseId:release,sourceCommit:b.sourceCommit,provenance:'operator-asserted',attestationVerified:false},201);
   }
   if(route[2]==='activation'&&request.method==='POST'){
    const b=object(await readJson(request),['releaseId','reason','routeEpoch']);const release=id(b.releaseId),reason=text(b.reason,200),expected=revision(request);
    if(!Number.isSafeInteger(b.routeEpoch)||b.routeEpoch!==tenantRow.route_epoch)throw new AppError(409,'ROUTE_EPOCH_CONFLICT');
    const r=await db.prepare('SELECT object_key,content_hash FROM tenant_releases WHERE tenant_id=? AND release_id=?').bind(tenant,release).first<{object_key:string;content_hash:string}>();
    if(!r)throw new AppError(404,'RELEASE_NOT_FOUND');
    if(r.object_key!==`tenants/${tenant}/packs/${r.content_hash}.json`)throw new AppError(503,'PACK_IDENTITY_MISMATCH');
    const obj=await env.PACKS.get(r.object_key);if(!obj)throw new AppError(503,'PACK_UNAVAILABLE');if(obj.size!==undefined&&obj.size>48_000)throw new AppError(503,'PACK_INTEGRITY');const body=await obj.text();if(await sha256(body)!==r.content_hash)throw new AppError(503,'PACK_INTEGRITY');const pack=parseTenantPack(JSON.parse(body));await validateAIProfile(db,tenant,pack);
    const result=await db.batch([
     db.prepare(`UPDATE tenant_deployments SET active_release_id=?,revision=revision+1 WHERE tenant_id=? AND revision=? AND EXISTS (SELECT 1 FROM tenants t JOIN tenant_lifecycle l ON l.tenant_id=t.id WHERE t.id=? AND t.state='active' AND l.state='ACTIVE' AND t.route_epoch=?)`).bind(release,tenant,expected,tenant,b.routeEpoch),
     db.prepare('INSERT INTO control_audit SELECT ?,?,?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),tenant,p.issuer,p.subject,'pack.activated',release,reason,now)
    ]);if(result[0]?.meta.changes!==1)throw new AppError(409,'REVISION_CONFLICT');return json({releaseId:release,revision:expected+1});
   }
   throw new AppError(404,'NOT_FOUND');
  }catch(e){const error=e instanceof AppError?e:new AppError(500,'CONTROL_ERROR');return json({error:{code:error.code}},error.status);}
 };
}
