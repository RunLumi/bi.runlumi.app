import {AppError} from '@runlumi/core/contracts.ts';
import type {CellRoutingEnv,Database} from '@runlumi/core/ports.ts';
import type {Env} from './cell.ts';
/** Dedicated customer deployment environment. The customer/environment identity is
 * server-owned: it comes from deployment configuration (wrangler vars), never from
 * the request, job payload or LLM arguments. */
export interface DeploymentEnv extends Env { CUSTOMER_ID: string; DEPLOYMENT_ID: string; ENVIRONMENT: string }
const ident = (value:string)=>/^[a-z0-9][a-z0-9-]{0,62}$/.test(value) && !/^0+$/.test(value.replaceAll('-',''));
/** Fail closed at startup when dedicated-deployment identity is missing or ambiguous. */
export function validateDeploymentEnv(env:DeploymentEnv):void {
  if(!ident(env.CUSTOMER_ID))throw new AppError(503,'DEPLOYMENT_NOT_CONFIGURED');
  if(!ident(env.DEPLOYMENT_ID)||!ident(env.ENVIRONMENT))throw new AppError(503,'DEPLOYMENT_NOT_CONFIGURED');
  if(!ident(env.CELL_ID)||env.CELL_ID!==env.DEPLOYMENT_ID)throw new AppError(503,'DEPLOYMENT_IDENTITY_MISMATCH');
  if(env.CUSTOMER_ID.length>64)throw new AppError(503,'DEPLOYMENT_NOT_CONFIGURED');
  const serving=env.SERVING as unknown;
  if(!serving||typeof (serving as Database).prepare!=='function')throw new AppError(503,'TENANT_ROUTING_UNAVAILABLE');
  let bindings:unknown;
  try{bindings=JSON.parse(env.TENANT_BINDINGS);}catch{throw new AppError(503,'TENANT_ROUTING_UNAVAILABLE');}
  // Exactly one fixed serving binding, declared by deployment configuration.
  if(!Array.isArray(bindings)||bindings.length!==1||bindings[0]!=='SERVING')throw new AppError(503,'TENANT_ROUTING_UNAVAILABLE');
  if(env.TENANT_BINDINGS!=='["SERVING"]')throw new AppError(503,'TENANT_ROUTING_UNAVAILABLE');
}
export interface DeploymentIdentity {customerId:string;deploymentId:string;environment:string}
/** Server-owned identity reported to the control plane and audit trail. */
export function deploymentIdentity(env:CellRoutingEnv):DeploymentIdentity|null{
  const e=env as Partial<DeploymentEnv>;
  if(e.CUSTOMER_ID===undefined)return null;
  return {customerId:e.CUSTOMER_ID,deploymentId:e.DEPLOYMENT_ID??'',environment:e.ENVIRONMENT??''};
}
