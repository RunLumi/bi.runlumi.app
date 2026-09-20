import {AppError} from './contracts.ts';
import type {ServiceBinding} from './ports.ts';
export async function controlRequest(control:ServiceBinding,original:Request,path:string,body?:unknown,demo=false):Promise<Response>{
  if(!control||typeof control.fetch!=='function')throw new AppError(503,'CONTROL_UNAVAILABLE');
  const headers=new Headers();
  const jwt=original.headers.get('cf-access-jwt-assertion');if(jwt)headers.set('cf-access-jwt-assertion',jwt);
  if(demo){const user=original.headers.get('x-demo-user');if(user)headers.set('x-demo-user',user);}
  const match=original.headers.get('if-match');if(match)headers.set('if-match',match);
  if(body!==undefined)headers.set('content-type','application/json');
  let response:Response;
  try{response=await control.fetch(new Request(`https://control.internal${path}`,{method:body!==undefined?(path==='/control/authorize'?'POST':original.method==='PUT'?'PUT':'POST'):'GET',headers,...(body!==undefined?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(5000)}));}
  catch{throw new AppError(503,'CONTROL_UNAVAILABLE');}
  if(!response.ok){let code='CONTROL_UNAVAILABLE';try{const b=await response.json() as {error?:{code?:string}};if(b.error?.code)code=b.error.code;}catch{}throw new AppError(response.status>=500?503:response.status,code);}
  return response;
}
