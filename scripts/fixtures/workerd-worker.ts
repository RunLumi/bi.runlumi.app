/** Minimal Worker entry composed ONLY from packaged public interfaces.
 * Used by scripts/workerd-check.mjs to prove the released tarballs evaluate
 * and authenticate correctly under real local workerd + local D1/R2. */
import {createApi} from '@runlumi/core/api.ts';
import {authenticateInstallation} from '@runlumi/cloudflare/request-auth.ts';
import type {AppEnv,Database,ObjectStore} from '@runlumi/core/ports.ts';

interface Env extends AppEnv {
  DB: Database;
  SOURCES: ObjectStore;
  ASSETS: {fetch(request:Request):Promise<Response>};
  ACCESS_TEAM?: string;
  ACCESS_AUD?: string;
}
const api=createApi<Env>(authenticateInstallation,false,{standalone:true});
export default {async fetch(request:Request,env:Env):Promise<Response>{
 const path=new URL(request.url).pathname;
 if(path.startsWith('/api/')||path==='/healthz')return api(request,env);
 return env.ASSETS.fetch(request);
}};
