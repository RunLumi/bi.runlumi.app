import {AppError,type Principal,type Role} from './contracts.ts';
import type {ActivePack} from './tenant-pack.ts';
import type {Feature} from './licensing.ts';
import type {CellRoutingEnv,Database,TenantContext} from './ports.ts';
import {controlRequest,controlScope} from './control-client.ts';
export type {TenantContext};
export async function authorizeTenant(env:CellRoutingEnv,principal:Principal,tenantId:string,request:Request,feature:Feature='bi.read',demo=false):Promise<TenantContext>{
  // Dedicated deployment fence: one deployment serves exactly its configured customer.
  if(env.CUSTOMER_ID!==undefined&&tenantId!==env.CUSTOMER_ID)throw new AppError(403,'CUSTOMER_MISMATCH');
  const response=await controlRequest(env.CONTROL,request,'/control/authorize',controlScope(env),{tenantId,cellId:env.CELL_ID,feature},demo);
  const row=await response.json() as {id:string;role:Role;binding_name:string;cell_id:string;active:ActivePack|null;features:Feature[];route_epoch:number};
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
