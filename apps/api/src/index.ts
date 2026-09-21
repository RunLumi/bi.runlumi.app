import {createApi} from '@runlumi/core/api.ts';
import {verifyAccessToken} from '@runlumi/cloudflare/auth.ts';
import type {AppEnv,Database,ObjectStore} from '@runlumi/core/ports.ts';

interface InstallationEnv extends AppEnv {
  DB: Database;
  SOURCES: ObjectStore;
  ASSETS: {fetch(request:Request):Promise<Response>};
  ACCESS_TEAM: string;
  ACCESS_AUD: string;
}
const api=createApi<InstallationEnv>(async(request,env)=>verifyAccessToken(request.headers.get('cf-access-jwt-assertion')??'',env.ACCESS_TEAM,env.ACCESS_AUD),false,{standalone:true});
export default {async fetch(request:Request,env:InstallationEnv):Promise<Response>{
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/')||path==='/healthz')return api(request,env);
  return env.ASSETS.fetch(request);
}};
