import {createApi} from '@runlumi/core/api.ts';
import {authenticateInstallation} from '@runlumi/cloudflare/request-auth.ts';
import type {AppEnv} from '@runlumi/core/ports.ts';

interface InstallationEnv extends AppEnv {
  DB: NonNullable<AppEnv['DB']>;
  SOURCES: NonNullable<AppEnv['SOURCES']>;
  ASSETS: {fetch(request:Request):Promise<Response>};
  ACCESS_TEAM?: string;
  ACCESS_AUD?: string;
}
const api=createApi<InstallationEnv>(authenticateInstallation,false,{standalone:true});
export default {async fetch(request:Request,env:InstallationEnv):Promise<Response>{
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/')||path==='/healthz')return api(request,env);
  return env.ASSETS.fetch(request);
}};
