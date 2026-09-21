import {createApi} from '@runlumi/core/api.ts';
import {authenticateInstallation} from '@runlumi/cloudflare/request-auth.ts';
import {executeCommerceJob,readCommerceJobs} from '@runlumi/core/commerce-jobs.ts';
import type {AppEnv,Database,ObjectStore} from '@runlumi/core/ports.ts';
import {customMetricExtensions} from '../../../customer/data/server-metrics.ts';
import {exampleAdapter} from '../../../customer/data/connectors.ts';
import {decisionRules} from '../../../customer/workflows/decisions.ts';
import {manifest} from '../../../customer/manifest.ts';

interface InstallationEnv extends AppEnv {
  DB: Database;
  SOURCES: ObjectStore;
  ASSETS: {fetch(request:Request):Promise<Response>};
  ACCESS_TEAM?: string;
  ACCESS_AUD?: string;
  ENVIRONMENT?: string;
}
const api=createApi<InstallationEnv>(authenticateInstallation,false,{customMetrics:customMetricExtensions,connectors:[exampleAdapter],decisionRules,modules:manifest.modules,standalone:true});

export default {async fetch(request:Request,env:InstallationEnv):Promise<Response>{
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/')||path==='/healthz')return api(request,env);
  return env.ASSETS.fetch(request);
},async scheduled(event:ScheduledController,env:InstallationEnv,ctx:ExecutionContext){
  ctx.waitUntil((async()=>{
    // The scheduled runner is server-owned authority, not a user: it cannot
    // sign in, holds no session and is recorded as 'system:job-runner' in audit.
    const authority={kind:'system' as const};
    const {jobs}=await readCommerceJobs(env.DB,authority);
    for(const job of jobs.filter(j=>j.state==='QUEUED'||j.state==='RETRY_PENDING').slice(0,10)){
      try{await executeCommerceJob(env.DB,authority,job.jobId,env.SOURCES);}catch{/* job recorded its own failure state */}}
  })());
}};
