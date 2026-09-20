import { createApi } from './api.ts';
import { verifyAccessToken } from './auth.ts';
import type { Env } from './bindings.ts';
const api=createApi(async(request,env)=>verifyAccessToken(request.headers.get('cf-access-jwt-assertion')??'',env.ACCESS_TEAM,env.ACCESS_AUD));
export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    const path=new URL(request.url).pathname;
    if(path.startsWith('/api/')||path==='/healthz')return api(request,env);
    // Static shell contains no customer data. All data APIs are authenticated independently.
    return env.ASSETS.fetch(request);
  }
};
