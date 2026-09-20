import {AppError,type Principal,type Role} from '../../../packages/core/contracts.ts';
import type {ActivePack} from '../../../packages/core/tenant-pack.ts';
import type {Feature} from '../../../packages/core/licensing.ts';
import type {Database,Env} from './bindings.ts';
import {controlRequest} from './control-client.ts';
export interface TenantContext {id:string;role:Role;db:Database;principal:Principal;active:ActivePack|null;features:Feature[]}
export async function authorizeTenant(env:Env,principal:Principal,tenantId:string,request:Request,feature:Feature='bi.read',demo=false):Promise<TenantContext>{
  const response=await controlRequest(env,request,'/control/authorize',{tenantId,cellId:env.CELL_ID,feature},demo);
  const row=await response.json() as {id:string;role:Role;binding_name:string;cell_id:string;active:ActivePack|null;features:Feature[]};
  if(row.id!==tenantId||row.cell_id!==env.CELL_ID)throw new AppError(503,'TENANT_ROUTING_UNAVAILABLE');
  const bindings:unknown=JSON.parse(env.TENANT_BINDINGS);
  if(!Array.isArray(bindings)||!bindings.every(x=>typeof x==='string'&&/^TENANT_[A-Z0-9_]+$/.test(x))||!bindings.includes(row.binding_name))throw new AppError(503,'TENANT_ROUTING_UNAVAILABLE');
  const db=env[row.binding_name] as Database|undefined;
  if(!db||typeof db.prepare!=='function')throw new AppError(503,'TENANT_ROUTING_UNAVAILABLE');
  const identity=await db.prepare('SELECT tenant_id FROM tenant_identity WHERE singleton=1').first<{tenant_id:string}>();
  if(!identity||identity.tenant_id!==tenantId)throw new AppError(503,'TENANT_IDENTITY_MISMATCH');
  if(!['viewer','editor','owner'].includes(row.role))throw new AppError(403,'ROLE_DENIED');
  return {id:tenantId,role:row.role,db,principal,active:row.active,features:row.features};
}
export function canEdit(ctx:TenantContext):void{if(ctx.role!=='editor'&&ctx.role!=='owner')throw new AppError(403,'EDITOR_REQUIRED');}
export function requireOwner(ctx:TenantContext):void{if(ctx.role!=='owner')throw new AppError(403,'OWNER_REQUIRED');}
