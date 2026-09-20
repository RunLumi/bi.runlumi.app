import { createApi } from '@runlumi/core/api.ts';
import { verifyAccessToken } from '@runlumi/cloudflare/auth.ts';
import { createCellWorker, type Env } from '@runlumi/cloudflare/cell.ts';
const api=createApi<Env>(async(request,env:Env)=>verifyAccessToken(request.headers.get('cf-access-jwt-assertion')??'',env.ACCESS_TEAM,env.ACCESS_AUD));
export default {
  async fetch(request:Request,env:Env):Promise<Response>{
    return createCellWorker({api})(request,env);
  }
};
