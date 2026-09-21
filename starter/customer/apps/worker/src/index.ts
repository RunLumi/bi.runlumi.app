import {createApi} from '@runlumi/core/api.ts';
import {verifyAccessToken} from '@runlumi/cloudflare/auth.ts';
import type {AppEnv,Database,ObjectStore} from '@runlumi/core/ports.ts';
import {customMetricExtensions} from '../../../customer/data/server-metrics.ts';
import {exampleAdapter} from '../../../customer/data/connectors.ts';
import {decisionRules} from '../../../customer/workflows/decisions.ts';
import {manifest} from '../../../customer/manifest.ts';

interface InstallationEnv extends AppEnv {
  DB: Database;
  SOURCES: ObjectStore;
  ASSETS: {fetch(request:Request):Promise<Response>};
  ACCESS_TEAM: string;
  ACCESS_AUD: string;
  DEPLOYMENT_ID: string;
  ENVIRONMENT: string;
}
const api=createApi<InstallationEnv>(async(request,env)=>verifyAccessToken(request.headers.get('cf-access-jwt-assertion')??'',env.ACCESS_TEAM,env.ACCESS_AUD),false,{customMetrics:customMetricExtensions,connectors:[exampleAdapter],decisionRules,modules:manifest.modules,standalone:true});

export default {async fetch(request:Request,env:InstallationEnv):Promise<Response>{
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/')||path==='/healthz')return api(request,env);
  return env.ASSETS.fetch(request);
}};
