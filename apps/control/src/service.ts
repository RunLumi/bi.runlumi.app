import {AppError,id,object,text,sha256,type Principal,type Role} from '../../../packages/core/contracts.ts';
import {features,effectiveFeatures,requireFeature,parseLicense,type Feature,type License} from '../../../packages/core/licensing.ts';
import {parseTenantPack,type ActivePack} from '../../../packages/core/tenant-pack.ts';
import {readJson,json,revision} from '../../../packages/core/http.ts';
import type {Database} from '../../api/src/bindings.ts';
import type {ControlEnv} from './bindings.ts';
type Auth=(request:Request,env:ControlEnv)=>Promise<Principal>;
type Member={id:string;name:string;binding_name:string;cell_id:string;role:Role};
function primary(db:Database):Database{return db.withSession?db.withSession('first-primary'):db;}
async function licenseFor(db:Database,tenant:string){return db.prepare('SELECT plan_id,state,starts_at,ends_at,grace_ends_at,features,revision FROM licenses WHERE tenant_id=?').bind(tenant).first<License>();}
async function membership(db:Database,p:Principal,tenant:string):Promise<Member>{
  const r=await db.prepare("SELECT t.id,t.name,t.binding_name,t.cell_id,m.role FROM tenants t JOIN memberships m ON m.tenant_id=t.id JOIN users u ON u.issuer=m.issuer AND u.subject=m.subject WHERE t.id=? AND t.state='active' AND m.state='active' AND u.state='active' AND m.issuer=? AND m.subject=?")
    .bind(tenant,p.issuer,p.subject).first<Member>();
  if(!r||!['viewer','editor','owner'].includes(r.role))throw new AppError(403,'TENANT_ACCESS_DENIED');return r;
}
async function operator(db:Database,p:Principal):Promise<void>{const r=await db.prepare("SELECT 1 AS ok FROM platform_operators o JOIN users u ON u.issuer=o.issuer AND u.subject=o.subject WHERE o.issuer=? AND o.subject=? AND u.state='active'").bind(p.issuer,p.subject).first();if(!r)throw new AppError(403,'PLATFORM_OPERATOR_REQUIRED');}
async function activePack(db:Database,env:ControlEnv,tenant:string):Promise<ActivePack|null>{
  const r=await db.prepare('SELECT d.active_release_id,r.release_id,r.content_hash,r.object_key,r.source_commit,d.revision FROM tenant_deployments d LEFT JOIN tenant_releases r ON r.tenant_id=d.tenant_id AND r.release_id=d.active_release_id WHERE d.tenant_id=?').bind(tenant).first<{active_release_id:string|null;release_id:string|null;content_hash:string;object_key:string;source_commit:string;revision:number}>();
  if(!r||r.active_release_id===null)return null;
  if(!r.release_id)throw new AppError(503,'PACK_UNAVAILABLE');
  if(r.object_key!==`tenants/${tenant}/packs/${r.content_hash}.json`)throw new AppError(503,'PACK_IDENTITY_MISMATCH');
  const obj=await env.PACKS.get(r.object_key);if(!obj)throw new AppError(503,'PACK_UNAVAILABLE');
  const body=await obj.text();if(body.length>48_000||await sha256(body)!==r.content_hash)throw new AppError(503,'PACK_INTEGRITY');
  return {releaseId:r.release_id,revision:r.revision,sourceCommit:r.source_commit,pack:parseTenantPack(JSON.parse(body))};
}
export function createControl(authenticate:Auth,clock:()=>number=Date.now){
 return async(request:Request,env:ControlEnv):Promise<Response>=>{
  try{
   const url=new URL(request.url);if(!url.pathname.startsWith('/control/'))throw new AppError(404,'NOT_FOUND');
   if(!['GET','POST','PUT'].includes(request.method))throw new AppError(405,'METHOD_NOT_ALLOWED');
   const p=await authenticate(request,env);const db=primary(env.CONTROL_DB);const now=new Date(clock()).toISOString();
   if(url.pathname==='/control/session'&&request.method==='GET'){
    const rows=await db.prepare("SELECT t.id,t.name,t.cell_id,m.role FROM tenants t JOIN memberships m ON m.tenant_id=t.id JOIN users u ON u.issuer=m.issuer AND u.subject=m.subject WHERE t.state='active' AND m.state='active' AND u.state='active' AND m.issuer=? AND m.subject=? ORDER BY t.id LIMIT 100").bind(p.issuer,p.subject).all();
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
    const t=await db.prepare('SELECT t.id,t.name,t.cell_id,t.state,l.plan_id,l.state AS license_state,l.ends_at,l.revision AS license_revision,d.active_release_id,d.revision AS config_revision FROM tenants t LEFT JOIN licenses l ON l.tenant_id=t.id LEFT JOIN tenant_deployments d ON d.tenant_id=t.id ORDER BY t.id LIMIT 100').all();
    const u=await db.prepare('SELECT u.issuer,u.subject,u.state,COUNT(m.tenant_id) AS tenant_count FROM users u LEFT JOIN memberships m ON m.issuer=u.issuer AND m.subject=u.subject AND m.state=\'active\' GROUP BY u.issuer,u.subject,u.state ORDER BY u.subject LIMIT 100').all();
    return json({tenants:t.results,users:u.results,limit:100,note:'Control metadata only. Operator role does not grant tenant-data access.'});
   }
   const route=/^\/control\/admin\/tenants\/([a-z0-9_-]{1,64})\/(license|releases|activation)$/.exec(url.pathname);
   if(!route)throw new AppError(404,'NOT_FOUND');const tenant=id(route[1]);
   if(!await db.prepare('SELECT id FROM tenants WHERE id=?').bind(tenant).first())throw new AppError(404,'NOT_FOUND');
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
    const pack=parseTenantPack(b.pack);const content=JSON.stringify(pack);const hash=await sha256(content);const release=`r_${(await sha256(b.sourceCommit+hash)).slice(0,32)}`;const key=`tenants/${tenant}/packs/${hash}.json`;
    const prior=await db.prepare('SELECT release_id,content_hash FROM tenant_releases WHERE tenant_id=? AND source_commit=?').bind(tenant,b.sourceCommit).first<{release_id:string;content_hash:string}>();
    if(prior){if(prior.content_hash!==hash)throw new AppError(409,'IMMUTABLE_RELEASE_CONFLICT');return json({releaseId:prior.release_id,replayed:true});}
    await env.PACKS.put(key,content,{httpMetadata:{contentType:'application/json'}});
    await db.batch([
     db.prepare('INSERT INTO tenant_releases VALUES (?,?,?,?,?,?)').bind(tenant,release,hash,key,b.sourceCommit,now),
     db.prepare('INSERT INTO control_audit VALUES (?,?,?,?,?,?,?,?)').bind(crypto.randomUUID(),tenant,p.issuer,p.subject,'pack.registered',release,'Reviewed source bundle',now)
    ]);return json({releaseId:release,sourceCommit:b.sourceCommit},201);
   }
   if(route[2]==='activation'&&request.method==='POST'){
    const b=object(await readJson(request),['releaseId','reason']);const release=id(b.releaseId),reason=text(b.reason,200),expected=revision(request);
    const r=await db.prepare('SELECT object_key,content_hash FROM tenant_releases WHERE tenant_id=? AND release_id=?').bind(tenant,release).first<{object_key:string;content_hash:string}>();
    if(!r)throw new AppError(404,'RELEASE_NOT_FOUND');
    if(r.object_key!==`tenants/${tenant}/packs/${r.content_hash}.json`)throw new AppError(503,'PACK_IDENTITY_MISMATCH');
    const obj=await env.PACKS.get(r.object_key);if(!obj)throw new AppError(503,'PACK_UNAVAILABLE');const body=await obj.text();if(await sha256(body)!==r.content_hash)throw new AppError(503,'PACK_INTEGRITY');parseTenantPack(JSON.parse(body));
    const result=await db.batch([
     db.prepare('UPDATE tenant_deployments SET active_release_id=?,revision=revision+1 WHERE tenant_id=? AND revision=?').bind(release,tenant,expected),
     db.prepare('INSERT INTO control_audit SELECT ?,?,?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),tenant,p.issuer,p.subject,'pack.activated',release,reason,now)
    ]);if(result[0]?.meta.changes!==1)throw new AppError(409,'REVISION_CONFLICT');return json({releaseId:release,revision:expected+1});
   }
   throw new AppError(404,'NOT_FOUND');
  }catch(e){const error=e instanceof AppError?e:new AppError(500,'CONTROL_ERROR');return json({error:{code:error.code}},error.status);}
 };
}
