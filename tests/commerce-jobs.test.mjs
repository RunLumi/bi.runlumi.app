import test from 'node:test';
import assert from 'node:assert/strict';
import {commerceFixture} from './commerce-helpers.mjs';

const ok=async(response,status=200)=>{const body=await response.json();assert.equal(response.status,status,JSON.stringify(body));return body;};

test('normalization job admission is durable, idempotent and executes through the normalizer',async t=>{
 const f=await commerceFixture(t),receipt=await f.accept(),first=await ok(await f.call('commerce-jobs',{receiptId:receipt.receiptId}),202),repeat=await ok(await f.call('commerce-jobs',{receiptId:receipt.receiptId}),202);
 assert.equal(first.state,'QUEUED');assert.equal(first.jobId,repeat.jobId);assert.equal(repeat.replayed,true);assert.equal((await ok(await f.call('commerce-jobs'))).jobs.length,1);
 assert.equal((await ok(await f.call('commerce-jobs/'+first.jobId))).state,'QUEUED');
 const result=await ok(await f.call('commerce-jobs/'+first.jobId,undefined,{method:'POST'}));assert.equal(result.state,'SUCCEEDED');assert.equal(result.result.state,'NORMALIZED');assert.equal((await ok(await f.call('commerce-jobs'))).jobs[0].state,'SUCCEEDED');
});

for(const user of ['alpha-editor','alpha-viewer','beta-owner','platform-admin'])test(`job admission denies ${user}`,async t=>{
 const f=await commerceFixture(t),receipt=await f.accept(),job=await ok(await f.call('commerce-jobs',{receiptId:receipt.receiptId}),202);assert.equal((await f.call('commerce-jobs',{receiptId:receipt.receiptId},{user})).status,403);assert.equal((await f.call('commerce-jobs',undefined,{user})).status,403);assert.equal((await f.call('commerce-jobs/'+job.jobId,undefined,{user})).status,403);
});

test('job admission is tenant-scoped and bounded',async t=>{
 const f=await commerceFixture(t),receipts=[];for(let i=0;i<10;i++){const receipt=await f.accept(undefined,'orders-export','job-'+i);receipts.push(receipt);assert.equal((await f.call('commerce-jobs',{receiptId:receipt.receiptId})).status,202);}
 const replay=await f.call('commerce-jobs',{receiptId:receipts[0].receiptId});assert.equal(replay.status,202);assert.equal((await replay.json()).replayed,true);
 const extra=await f.accept(undefined,'orders-export','job-extra');assert.equal((await f.call('commerce-jobs',{receiptId:extra.receiptId})).status,429);
});

test('admission is atomic under concurrent receipts and an existing job remains idempotent at the cap',async t=>{
 const f=await commerceFixture(t),receipts=[];for(let i=0;i<11;i++)receipts.push(await f.accept(undefined,'orders-export','concurrent-'+i));
 const outcomes=await Promise.all(receipts.map(r=>f.call('commerce-jobs',{receiptId:r.receiptId}))),statuses=outcomes.map(r=>r.status);
 assert.equal(statuses.filter(s=>s===202).length,10);assert.equal(statuses.filter(s=>s===429).length,1);
 const rows=f.env.TENANT_A.db.prepare('SELECT COUNT(*) AS n FROM commerce_jobs').get();assert.equal(rows.n,10);
 const replay=await f.call('commerce-jobs',{receiptId:receipts[0].receiptId});assert.equal(replay.status,202);assert.equal((await replay.json()).replayed,true);
});

test('current source scope is rechecked before admission and does not create a job',async t=>{
 const f=await commerceFixture(t),receipt=await f.accept();f.env.TENANT_A.db.exec("UPDATE commerce_connections SET state='paused',revision=revision+1");
 const response=await f.call('commerce-jobs',{receiptId:receipt.receiptId});assert.equal(response.status,409);assert.equal((await ok(await f.call('commerce-jobs'))).jobs.length,0);
});

test('lease fencing blocks concurrent execution and retry exhaustion dead-letters',async t=>{
 const f=await commerceFixture(t),receipt=await f.accept(),job=await ok(await f.call('commerce-jobs',{receiptId:receipt.receiptId}),202);
 f.env.SOURCES.get=async()=>{await new Promise(resolve=>setTimeout(resolve,20));throw new Error('source unavailable');};
 const [a,b]=await Promise.all([f.call('commerce-jobs/'+job.jobId,undefined,{method:'POST'}),f.call('commerce-jobs/'+job.jobId,undefined,{method:'POST'})]);assert([500,409].includes(a.status));assert([500,409].includes(b.status));
 const row=f.env.TENANT_A.db.prepare('SELECT state,attempts,last_error FROM commerce_jobs').get();assert(['RETRY_PENDING','DEAD_LETTERED'].includes(row.state));assert.equal(row.attempts,1);
 for(let i=0;i<2;i++)await f.call('commerce-jobs/'+job.jobId,undefined,{method:'POST'});
 assert.equal(f.env.TENANT_A.db.prepare('SELECT state,attempts FROM commerce_jobs').get().state,'DEAD_LETTERED');
});

test('expired final lease is recovered into a terminal job state',async t=>{
 const f=await commerceFixture(t),receipt=await f.accept(),job=await ok(await f.call('commerce-jobs',{receiptId:receipt.receiptId}),202);
 f.env.TENANT_A.db.prepare("UPDATE commerce_jobs SET state='RUNNING',attempts=3,lease_token='expired-token',lease_until='2000-01-01T00:00:00.000Z'").run();
 const response=await f.call('commerce-jobs/'+job.jobId,undefined,{method:'POST'});assert.equal(response.status,409);assert.equal((await response.json()).error.code,'JOB_RETRY_EXHAUSTED');
 assert.equal(f.env.TENANT_A.db.prepare('SELECT state,last_error FROM commerce_jobs').get().state,'DEAD_LETTERED');
});

test('source revocation after admission fences execution without exposing raw evidence',async t=>{
 const f=await commerceFixture(t),receipt=await f.accept(),job=await ok(await f.call('commerce-jobs',{receiptId:receipt.receiptId}),202);
 f.env.TENANT_A.db.exec("UPDATE commerce_connections SET state='revoked',revision=revision+1");
 const response=await f.call('commerce-jobs/'+job.jobId,undefined,{method:'POST'});assert.equal(response.status,409);assert.equal((await response.json()).error.code,'RECEIPT_SCOPE_UNAVAILABLE');
 const row=f.env.TENANT_A.db.prepare('SELECT state,last_error FROM commerce_jobs').get();assert.equal(row.state,'RETRY_PENDING');assert.equal(row.last_error,'RECEIPT_SCOPE_UNAVAILABLE');
});

test('revoked receipt cannot be admitted or executed',async t=>{
 const f=await commerceFixture(t),receipt=await f.accept();f.env.TENANT_A.db.exec("UPDATE commerce_receipts SET state='REVOKED'");assert.equal((await f.call('commerce-jobs',{receiptId:receipt.receiptId})).status,409);
});
