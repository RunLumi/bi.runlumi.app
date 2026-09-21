import {AppError,object,text,type Principal,type Role} from './contracts.ts';
import type {ActivePack} from './tenant-pack.ts';
import {features as knownFeatures,type Feature} from './licensing.ts';
import type {CellRoutingEnv,Database,TenantContext} from './ports.ts';
import {controlRequest,controlScope} from './control-client.ts';
export type {TenantContext};
export async function authorizeTenant(env:CellRoutingEnv,principal:Principal,tenantId:string,request:Request,feature:Feature='bi.read',demo=false,standalone=false):Promise<TenantContext>{
  // Dedicated deployment fence: one deployment serves exactly its configured customer.
  if(env.CUSTOMER_ID!==undefined&&tenantId!==env.CUSTOMER_ID)throw new AppError(403,'CUSTOMER_MISMATCH');
  let row:{id:string;role:Role;binding_name:string;cell_id:string;active:ActivePack|null;features:Feature[];route_epoch:number};
  if(standalone){
    const membershipDb=env.SERVING as Database|undefined;if(!membershipDb||typeof membershipDb.prepare!=='function')throw new AppError(503,'TENANT_ROUTING_UNAVAILABLE');
    const local=await membershipDb.prepare('SELECT m.role,m.state,e.state AS entitlement_state,e.features FROM local_memberships m JOIN local_entitlements e ON e.tenant_id=m.tenant_id WHERE m.tenant_id=? AND m.issuer=? AND m.subject=?').bind(tenantId,principal.issuer,principal.subject).first<{role:Role;state:string;entitlement_state:string;features:string}>();
    if(!local||local.state!=='active'||local.entitlement_state!=='active')throw new AppError(403,'TENANT_ACCESS_DENIED');
    let parsed:unknown;try{parsed=JSON.parse(local.features);}catch{throw new AppError(503,'LOCAL_AUTHORITY_INVALID');}
    if(!Array.isArray(parsed)||!parsed.every(f=>knownFeatures.includes(f as Feature)))throw new AppError(503,'LOCAL_AUTHORITY_INVALID');
    row={id:tenantId,role:local.role,binding_name:'SERVING',cell_id:env.CELL_ID,active:null,features:parsed as Feature[],route_epoch:1};
  }else{
    if(!env.CONTROL)throw new AppError(503,'CONTROL_UNAVAILABLE');
    const response=await controlRequest(env.CONTROL,request,'/control/authorize',controlScope(env),{tenantId,cellId:env.CELL_ID,feature},demo);
    row=await response.json() as {id:string;role:Role;binding_name:string;cell_id:string;active:ActivePack|null;features:Feature[];route_epoch:number};
  }
  if(row.id!==tenantId||row.cell_id!==env.CELL_ID)throw new AppError(503,'TENANT_ROUTING_UNAVAILABLE');
  const bindings:unknown=JSON.parse(env.TENANT_BINDINGS);
  if(!Array.isArray(bindings)||!bindings.every(x=>typeof x==='string'&&/^TENANT_[A-Z0-9_]+$|^SERVING$/.test(x))||!bindings.includes(row.binding_name))throw new AppError(503,'TENANT_ROUTING_UNAVAILABLE');
  const db=env[row.binding_name] as Database|undefined;
  if(!db||typeof db.prepare!=='function')throw new AppError(503,'TENANT_ROUTING_UNAVAILABLE');
  const identity=await db.prepare('SELECT tenant_id,route_epoch FROM tenant_identity WHERE singleton=1').first<{tenant_id:string;route_epoch:number}>();
  if(!identity||identity.tenant_id!==tenantId)throw new AppError(503,'TENANT_IDENTITY_MISMATCH');
  // Dedicated deployments additionally require the serving D1 to declare this exact
  // deployment. A database swapped from another environment (or customer) of the
  // same tenant fails here even though tenant_id and route_epoch happen to match.
  if(env.CUSTOMER_ID!==undefined){
    const e=env as {DEPLOYMENT_ID?:string;ENVIRONMENT?:string};
    const serving=await db.prepare('SELECT customer_id,deployment_id,environment FROM serving_identity WHERE singleton=1').first<{customer_id:string;deployment_id:string;environment:string}>();
    if(!serving||serving.customer_id!==env.CUSTOMER_ID||serving.deployment_id!==e.DEPLOYMENT_ID||serving.environment!==e.ENVIRONMENT)throw new AppError(503,'SERVING_IDENTITY_MISMATCH');
  }
  if(!Number.isSafeInteger(row.route_epoch)||row.route_epoch<1||identity.route_epoch!==row.route_epoch)throw new AppError(503,'TENANT_ROUTE_FENCED');
  if(!['viewer','editor','owner'].includes(row.role))throw new AppError(403,'ROLE_DENIED');
  return {id:tenantId,role:row.role,db,principal,active:row.active,features:row.features,routeEpoch:row.route_epoch};
}
export function canEdit(ctx:TenantContext):void{if(ctx.role!=='editor'&&ctx.role!=='owner')throw new AppError(403,'EDITOR_REQUIRED');}
export function requireOwner(ctx:TenantContext):void{if(ctx.role!=='owner')throw new AppError(403,'OWNER_REQUIRED');}
export async function readLocalMembers(ctx:TenantContext){
 requireOwner(ctx);const rows=await ctx.db.prepare('SELECT issuer,subject,role,state,created_at,updated_at FROM local_memberships WHERE tenant_id=? ORDER BY subject LIMIT 100').bind(ctx.id).all();return {members:rows.results,authority:'customer-local'};
}
export async function writeLocalMember(ctx:TenantContext,input:unknown){
 requireOwner(ctx);const b=object(input,['issuer','subject','role','state']),issuer=text(b.issuer,200),subject=text(b.subject,200),role=String(b.role),state=String(b.state);
 if(!['viewer','editor','owner'].includes(role)||!['active','revoked'].includes(state))throw new AppError(422,'INVALID_LOCAL_MEMBER');
 const now=new Date().toISOString();const result=await ctx.db.batch([
  ctx.db.prepare('INSERT INTO local_memberships (tenant_id,issuer,subject,role,state,created_at,updated_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT(tenant_id,issuer,subject) DO UPDATE SET role=excluded.role,state=excluded.state,updated_at=excluded.updated_at').bind(ctx.id,issuer,subject,role,state,now,now),
  ctx.db.prepare('INSERT INTO local_authority_audit VALUES (?,?,?,?,?,?,?)').bind(crypto.randomUUID(),ctx.id,ctx.principal.issuer,ctx.principal.subject,'membership.updated',issuer+':'+subject,now)
 ]);if(result.some(r=>!r.success))throw new AppError(503,'LOCAL_AUTHORITY_WRITE_FAILED');return {issuer,subject,role,state,updatedAt:now,authority:'customer-local'};
}
