import {createApi} from '@runlumi/core/api.ts';
import {verifyAccessToken} from '@runlumi/cloudflare/auth.ts';
import {createCellWorker} from '@runlumi/cloudflare/cell.ts';
import {validateDeploymentEnv,type DeploymentEnv} from '@runlumi/cloudflare/deployment.ts';
// Synthetic in-worker control: proves the packaged module graph executes in workerd
// without the central control service or any customer data.
const control=async(request:Request):Promise<Response>=>{
 const url=new URL(request.url);
 if(url.pathname==='/control/authorize'){
  const body=await request.json() as {tenantId:string};
  const subject=request.headers.get('x-demo-user')??'';
  if(subject!=='alpha-owner')return Response.json({error:{code:'TENANT_ACCESS_DENIED'}},{status:403});
  return Response.json({id:body.tenantId,role:'owner',binding_name:'SERVING',cell_id:'alpha-production',active:null,features:['bi.read','data.import'],route_epoch:1});
 }
 if(url.pathname==='/control/session')return Response.json({tenants:[{id:'alpha',cell_id:'alpha-production'}],platformOperator:false});
 return Response.json({error:{code:'NOT_FOUND'}},{status:404});
};
const api=createApi<DeploymentEnv>(async(request,env)=>verifyAccessToken(request.headers.get('cf-access-jwt-assertion')??'',env.ACCESS_TEAM,env.ACCESS_AUD));
const cell=createCellWorker({api:api as (request:Request,env:import('@runlumi/cloudflare/cell.ts').Env)=>Promise<Response>});
export default {
 async fetch(request:Request,env:DeploymentEnv):Promise<Response>{
  const url=new URL(request.url);
  if(url.pathname==='/fence'){
   try{validateDeploymentEnv(env);return Response.json({ok:true});}
   catch(error){const e=error as {code?:string;status?:number};return Response.json({code:e.code},{status:e.status??500});}
  }
  if(url.pathname.startsWith('/api/')||url.pathname==='/healthz'){
   try{validateDeploymentEnv(env);}catch(error){const e=error as {code?:string;status?:number};return Response.json({error:{code:e.code}},{status:e.status??500});}
   return api(request,{...env,CONTROL:{fetch:control}});
  }
  return env.ASSETS.fetch(request);
 }
};
