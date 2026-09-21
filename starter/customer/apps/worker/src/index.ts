import {createApi} from '@runlumi/core/api.ts';
import {authenticateInstallation} from '@runlumi/cloudflare/request-auth.ts';
import {executeCommerceJob,readCommerceJobs} from '@runlumi/core/commerce-jobs.ts';
import type {AppEnv,Database,ObjectStore} from '@runlumi/core/ports.ts';
import type {InstallationUser} from '@runlumi/core/installation-auth.ts';
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

/** Server-owned runner identity for scheduled job execution. It exists only
 * inside the Worker runtime; it cannot sign in and owns no session. */
const jobRunner:InstallationUser={id:'job-runner',issuer:'system',subject:'job-runner',displayName:'Job runner',role:'owner',state:'active'};

export default {async fetch(request:Request,env:InstallationEnv):Promise<Response>{
  const path=new URL(request.url).pathname;
  if(path.startsWith('/api/')||path==='/healthz')return api(request,env);
  return env.ASSETS.fetch(request);
},async scheduled(event:ScheduledController,env:InstallationEnv,ctx:ExecutionContext){
  ctx.waitUntil((async()=>{
    const {jobs}=await readCommerceJobs(env.DB,jobRunner);
    for(const job of jobs.filter(j=>j.state==='QUEUED'||j.state==='RETRY_PENDING').slice(0,10)){
      try{await executeCommerceJob(env.DB,jobRunner,job.jobId,env.SOURCES);}catch{/* job recorded its own failure state */}}
  })());
}};
