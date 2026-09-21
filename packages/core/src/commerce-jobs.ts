import {AppError,id,object} from './contracts.ts';
import {normalizeCommerceReceipt} from './commerce-normalization.ts';
import {requireInstallationRole,type InstallationUser} from './installation-auth.ts';
import type {Database,ObjectStore} from './ports.ts';
const primary=(db:Database)=>db.withSession?db.withSession('first-primary'):db;
const MAX_ADMITTED=10,MAX_ATTEMPTS=3,LEASE_MS=60_000;
type Job={id:string;kind:string;receipt_id:string;state:string;attempts:number;lease_token:string|null;lease_until:string|null;last_error:string|null;created_at:string;updated_at:string};
const jobStates=new Set(['PENDING','RUNNING','RETRY_PENDING','COMPLETED','DEAD_LETTERED','CANCELLED']);
const publicState=(state:string)=>state==='PENDING'?'QUEUED':state==='COMPLETED'?'SUCCEEDED':state==='DEAD_LETTERED'?'FAILED':jobStates.has(state)?state:'FAILED';
const view=(j:Job)=>({jobId:j.id,kind:j.kind,receiptId:j.receipt_id,state:publicState(j.state),attempts:j.attempts,leaseUntil:j.lease_until,lastError:j.last_error,createdAt:j.created_at,updatedAt:j.updated_at});
const requireCommerceOwner=(actor:InstallationUser)=>requireInstallationRole(actor,'owner');
const readJob=async(db:ReturnType<typeof primary>,jobId:string)=>db.prepare('SELECT * FROM commerce_jobs WHERE id=?').bind(jobId).first<Job>();
const readActiveReceipt=async(db:ReturnType<typeof primary>,receiptId:string)=>db.prepare(`SELECT r.id,r.state,r.connection_id,r.connection_revision FROM commerce_receipts r
 JOIN commerce_connections c ON c.id=r.connection_id
 WHERE r.id=? AND r.state!='REVOKED' AND c.state='active' AND c.revision=r.connection_revision`).bind(receiptId).first<{id:string;state:string;connection_id:string;connection_revision:number}>();
const retryable=(error:unknown)=>{
 if(!(error instanceof AppError))return true;
 if(error.status<500)return false;
 return !new Set(['RAW_EVIDENCE_INTEGRITY','RAW_EVIDENCE_IDENTITY_MISMATCH','NORMALIZER_VERSION_CONFLICT','SOURCE_OR_STATE_CHANGED','RECEIPT_SCOPE_UNAVAILABLE']).has(error.code);
};
export async function enqueueCommerceJob(db:Database,actor:InstallationUser,input:unknown,clock=Date.now){
 requireCommerceOwner(actor);const b=object(input,['receiptId']),receiptId=id(b.receiptId),d=primary(db),now=new Date(clock()).toISOString(),jobId='cj_'+receiptId;
 const receipt=await readActiveReceipt(d,receiptId);if(!receipt)throw new AppError(409,'RECEIPT_SCOPE_UNAVAILABLE');
 if(!['ACCEPTED','RETRY_PENDING'].includes(receipt.state))throw new AppError(409,'RECEIPT_NOT_PENDING');
 const prior=await readJob(d,jobId);if(prior)return {...view(prior),replayed:true};
 const result=await d.batch([d.prepare(`INSERT INTO commerce_jobs
   (id,kind,receipt_id,state,attempts,lease_token,lease_until,last_error,created_at,updated_at)
   SELECT ?,'NORMALIZE_RECEIPT',?,'PENDING',0,NULL,NULL,NULL,?,?
   WHERE EXISTS (SELECT 1 FROM commerce_receipts r JOIN commerce_connections c ON c.id=r.connection_id
     WHERE r.id=? AND r.state IN ('ACCEPTED','RETRY_PENDING') AND c.state='active' AND c.revision=r.connection_revision)
     AND (SELECT COUNT(*) FROM commerce_jobs WHERE state IN ('PENDING','RUNNING','RETRY_PENDING')) < ?
   ON CONFLICT(kind,receipt_id) DO NOTHING`).bind(jobId,receiptId,now,now,receiptId,MAX_ADMITTED)]);
 if(result[0]?.meta.changes!==1){
   const winner=await readJob(d,jobId);if(winner)return {...view(winner),replayed:true};
   const latest=await readActiveReceipt(d,receiptId);if(!latest)throw new AppError(409,'RECEIPT_SCOPE_UNAVAILABLE');
   if(!['ACCEPTED','RETRY_PENDING'].includes(latest.state))throw new AppError(409,'RECEIPT_NOT_PENDING');
   const count=await d.prepare("SELECT COUNT(*) AS n FROM commerce_jobs WHERE state IN ('PENDING','RUNNING','RETRY_PENDING')").first<{n:number}>();
   if((count?.n??0)>=MAX_ADMITTED)throw new AppError(429,'JOB_ADMISSION_LIMIT');
   throw new AppError(503,'JOB_ADMISSION_RACE');
 }
 const job=await readJob(d,jobId);if(!job)throw new AppError(503,'JOB_PERSISTENCE_FAILED');return {...view(job),replayed:false};
}
export async function readCommerceJobs(db:Database,actor:InstallationUser){requireCommerceOwner(actor);const rows=await primary(db).prepare('SELECT * FROM commerce_jobs ORDER BY created_at DESC,id DESC LIMIT 50').all<Job>();return {jobs:rows.results.map(view),limit:50};}
export async function readCommerceJob(db:Database,actor:InstallationUser,jobIdValue:string){requireCommerceOwner(actor);const job=await readJob(primary(db),id(jobIdValue));if(!job)throw new AppError(404,'JOB_NOT_FOUND');return view(job);}
export async function executeCommerceJob(db:Database,actor:InstallationUser,jobIdValue:string,objects:ObjectStore,clock=Date.now){
 requireCommerceOwner(actor);const jobId=id(jobIdValue),d=primary(db),now=clock(),nowIso=new Date(now).toISOString();
 let job=await readJob(d,jobId);if(!job)throw new AppError(404,'JOB_NOT_FOUND');
 if(job.state==='COMPLETED')return {...view(job),replayed:true};if(job.state==='DEAD_LETTERED'||job.state==='CANCELLED')throw new AppError(409,'JOB_NOT_EXECUTABLE');
 const leaseUntil=job.lease_until?Date.parse(job.lease_until):NaN;
 if(job.state==='RUNNING'&&!Number.isFinite(leaseUntil))throw new AppError(503,'JOB_LEASE_INVALID');
 if(job.state==='RUNNING'&&Number.isFinite(leaseUntil)&&leaseUntil>now)throw new AppError(409,'JOB_LEASE_HELD');
 if(job.attempts>=MAX_ATTEMPTS){
   const canFinalize=job.state!=='RUNNING'||!Number.isFinite(leaseUntil)||leaseUntil<=now;
   if(canFinalize){
     const finalized=await d.batch([
       d.prepare(`UPDATE commerce_receipts SET state='DEAD_LETTERED' WHERE id=? AND EXISTS (SELECT 1 FROM commerce_jobs WHERE id=? AND (state IN ('PENDING','RETRY_PENDING') OR state='RUNNING' AND lease_until<=?))`).bind(job.receipt_id,jobId,nowIso),
       d.prepare(`UPDATE commerce_jobs SET state='DEAD_LETTERED',lease_token=NULL,lease_until=NULL,last_error='JOB_RETRY_EXHAUSTED',updated_at=? WHERE id=? AND attempts>=? AND (state IN ('PENDING','RETRY_PENDING') OR state='RUNNING' AND lease_until<=?)`).bind(nowIso,jobId,MAX_ATTEMPTS,nowIso)
     ]);
     if(finalized[1]?.meta.changes===1)throw new AppError(409,'JOB_RETRY_EXHAUSTED');
     job=await readJob(d,jobId);if(job?.state==='COMPLETED')return {...view(job),replayed:true};
   }
   throw new AppError(409,'JOB_RETRY_EXHAUSTED');
 }
 const token=crypto.randomUUID(),newLeaseUntil=new Date(now+LEASE_MS).toISOString(),claimed=await d.batch([
   d.prepare(`UPDATE commerce_jobs SET state='RUNNING',attempts=attempts+1,lease_token=?,lease_until=?,updated_at=?
     WHERE id=? AND attempts<?
       AND (state IN ('PENDING','RETRY_PENDING') OR state='RUNNING' AND lease_until<=?)
       AND EXISTS (SELECT 1 FROM commerce_receipts r
         JOIN commerce_connections c ON c.id=r.connection_id
         WHERE r.id=commerce_jobs.receipt_id AND r.state!='REVOKED'
           AND c.state='active' AND c.revision=r.connection_revision)`).bind(token,newLeaseUntil,nowIso,jobId,MAX_ATTEMPTS,nowIso),
   d.prepare(`UPDATE commerce_receipts SET state='NORMALIZING' WHERE id=? AND state IN ('ACCEPTED','RETRY_PENDING')`).bind(job.receipt_id)
 ]);
 if(claimed[0]?.meta.changes!==1){
   job=await readJob(d,jobId);if(job?.state==='COMPLETED')return {...view(job),replayed:true};
   if(job?.state==='RUNNING'&&job.lease_until&&Date.parse(job.lease_until)>now)throw new AppError(409,'JOB_LEASE_HELD');
   if(job?.attempts&&job.attempts>=MAX_ATTEMPTS)throw new AppError(409,'JOB_RETRY_EXHAUSTED');
   if(job?.state==='PENDING'||job?.state==='RETRY_PENDING'){
     const deferredAt=new Date(clock()).toISOString();
     const deferred=await d.batch([
       d.prepare("UPDATE commerce_receipts SET state='RETRY_PENDING' WHERE id=? AND state!='REVOKED'").bind(job.receipt_id),
       d.prepare("UPDATE commerce_jobs SET state='RETRY_PENDING',lease_token=NULL,lease_until=NULL,last_error='RECEIPT_SCOPE_UNAVAILABLE',updated_at=? WHERE id=? AND state IN ('PENDING','RETRY_PENDING')").bind(deferredAt,jobId)
     ]);
     if(deferred[1]?.meta.changes!==1)throw new AppError(409,'JOB_LEASE_CONFLICT');
   }
   throw new AppError(409,'RECEIPT_SCOPE_UNAVAILABLE');
 }
 try {
  const result=await normalizeCommerceReceipt(d,objects,actor,{receiptId:job.receipt_id},clock);
  const completedAt=new Date(clock()).toISOString(),finished=await d.batch([d.prepare("UPDATE commerce_jobs SET state='COMPLETED',lease_token=NULL,lease_until=NULL,last_error=NULL,updated_at=? WHERE id=? AND state='RUNNING' AND lease_token=?").bind(completedAt,jobId,token)]);
  if(finished[0]?.meta.changes!==1)throw new AppError(409,'JOB_LEASE_LOST');return {...view({...job,state:'COMPLETED',attempts:job.attempts+1,lease_token:null,lease_until:null,last_error:null,updated_at:completedAt} as Job),result,replayed:false};
 } catch(error) {
  const code=error instanceof AppError?error.code:'JOB_EXECUTION_FAILED',attempts=job.attempts+1,state=retryable(error)&&attempts<MAX_ATTEMPTS?'RETRY_PENDING':'DEAD_LETTERED',receiptState=state==='RETRY_PENDING'?'RETRY_PENDING':'DEAD_LETTERED',failedAt=new Date(clock()).toISOString();
  const failed=await d.batch([
    d.prepare(`UPDATE commerce_receipts SET state=? WHERE id=? AND EXISTS (SELECT 1 FROM commerce_jobs WHERE id=? AND state='RUNNING' AND lease_token=?)`).bind(receiptState,job.receipt_id,jobId,token),
    d.prepare(`UPDATE commerce_jobs SET state=?,lease_token=NULL,lease_until=NULL,last_error=?,updated_at=? WHERE id=? AND state='RUNNING' AND lease_token=?`).bind(state,code,failedAt,jobId,token)
  ]);
  if(failed[1]?.meta.changes!==1)throw new AppError(409,'JOB_LEASE_LOST');throw error;
 }
}
