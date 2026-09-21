import {createApi} from '@runlumi/core/api.ts';
import {verifyAccessToken} from '@runlumi/cloudflare/auth.ts';
import {createCellWorker,type Env} from '@runlumi/cloudflare/cell.ts';
import {validateDeploymentEnv,type DeploymentEnv} from '@runlumi/cloudflare/deployment.ts';
import {customMetricExtensions} from '../../../customer/data/server-metrics.ts';
import {exampleAdapter} from '../../../customer/data/connectors.ts';
import {decisionRules} from '../../../customer/workflows/decisions.ts';
import {manifest} from '../../../customer/manifest.ts';

// Extensions are reviewed composition: they compile to the same Worker and run
// through the same tenant authorization. Module gating is server-enforced, so a
// disabled module denies the route before even attempting tenant routing.
const api=createApi<DeploymentEnv>(async(request,env)=>verifyAccessToken(request.headers.get('cf-access-jwt-assertion')??'',env.ACCESS_TEAM,env.ACCESS_AUD),false,{customMetrics:customMetricExtensions,connectors:[exampleAdapter],decisionRules,modules:manifest.modules,standalone:true});

export default {
 async fetch(request:Request,env:DeploymentEnv):Promise<Response>{
  // Fail closed before any customer data path is reachable. The customer identity and
  // the serving database binding are server-owned deployment configuration.
  validateDeploymentEnv(env);
  return createCellWorker({api:api as (request:Request,env:Env)=>Promise<Response>})(request,env);
 }
};
