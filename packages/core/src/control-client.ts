import {AppError} from './contracts.ts';
import type {CellRoutingEnv,ServiceBinding} from './ports.ts';
import {LUMI_CONTROL_API} from './version.ts';
/** Bounded deployment locator sent to Control with every forwarded request. The
 * value is server-owned (wrangler vars), never derived from the request or the
 * token. Control treats it as a lookup key into the registered deployment policy;
 * it confers no authority by itself. */
export function controlScope(env:CellRoutingEnv):{deploymentId:string;controlApi:number}{
  const deploymentId=(env as {DEPLOYMENT_ID?:string}).DEPLOYMENT_ID??env.CELL_ID;
  return {deploymentId,controlApi:LUMI_CONTROL_API};
}
export async function controlRequest(control:ServiceBinding,original:Request,path:string,scope:{deploymentId:string;controlApi:number},body?:unknown,demo=false):Promise<Response>{
  if(!control||typeof control.fetch!=='function')throw new AppError(503,'CONTROL_UNAVAILABLE');
  const headers=new Headers();
  const jwt=original.headers.get('cf-access-jwt-assertion');if(jwt)headers.set('cf-access-jwt-assertion',jwt);
  if(demo){const user=original.headers.get('x-demo-user');if(user)headers.set('x-demo-user',user);}
  const match=original.headers.get('if-match');if(match)headers.set('if-match',match);
  headers.set('x-lumi-deployment',scope.deploymentId);
  headers.set('x-lumi-control-api',String(scope.controlApi));
  if(body!==undefined)headers.set('content-type','application/json');
  let response:Response;
  try{response=await control.fetch(new Request(`https://control.internal${path}`,{method:body!==undefined?(path==='/control/authorize'?'POST':original.method==='PUT'?'PUT':'POST'):'GET',headers,...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(5000)}));}
  catch{throw new AppError(503,'CONTROL_UNAVAILABLE');}
  if(!response.ok){let code='CONTROL_UNAVAILABLE';try{const b=await response.json() as {error?:{code?:string}};if(b.error?.code)code=b.error.code;}catch{}throw new AppError(response.status>=500?503:response.status,code);}
  return response;
}