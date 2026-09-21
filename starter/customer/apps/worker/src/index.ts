import {createApi} from '@runlumi/core/api.ts';
import {verifyAccessToken} from '@runlumi/cloudflare/auth.ts';
import {createCellWorker,type Env} from '@runlumi/cloudflare/cell.ts';
import {validateDeploymentEnv,type DeploymentEnv} from '@runlumi/cloudflare/deployment.ts';
import {customMetricExtensions} from '../../../customer/data/server-metrics.ts';

const api=createApi<DeploymentEnv>(async(request,env)=>verifyAccessToken(request.headers.get('cf-access-jwt-assertion')??'',env.ACCESS_TEAM,env.ACCESS_AUD),false,{customMetrics:customMetricExtensions});

export default {
 async fetch(request:Request,env:DeploymentEnv):Promise<Response>{
  // Fail closed before any customer data path is reachable. The customer identity and
  // the serving database binding are server-owned deployment configuration.
  validateDeploymentEnv(env);
  return createCellWorker({api:api as (request:Request,env:Env)=>Promise<Response>})(request,env);
 }
};
