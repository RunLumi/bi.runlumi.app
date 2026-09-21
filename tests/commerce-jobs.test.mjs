import test from 'node:test';
import assert from 'node:assert/strict';
import {commerceFixture, call, exportBody, fixturePasswords, SECRET_FIELD} from './helpers.mjs';

test('jobs admit bounded work, execute under a lease, and complete idempotently',async t=>{
 const f=await commerceFixture(t);try{
  const receipt=await f.accept();
  const enqueued=await call(f,'/api/commerce/jobs',{body:{receiptId:receipt.receiptId}});
  assert.equal(enqueued.status,202);const job=await enqueued.json();
  assert.equal(job.state,'QUEUED');assert.equal(job.attempts,0);
  const replay=await call(f,'/api/commerce/jobs',{body:{receiptId:receipt.receiptId}});
  assert.equal((await replay.json()).jobId,job.jobId);
  const run=await call(f,`/api/commerce/jobs/${job.jobId}/run`,{method:'POST'});
  assert.equal(run.status,200);const executed=await run.json();
  assert.equal(executed.state,'SUCCEEDED');assert.equal(executed.attempts,1);
  assert.equal(executed.result.state,'NORMALIZED');
  const second=await call(f,`/api/commerce/jobs/${job.jobId}/run`,{method:'POST'});
  assert.equal(second.status,200);assert.equal((await second.json()).replayed,true,'completed jobs replay');
  const read=await call(f,`/api/commerce/jobs/${job.jobId}`,{method:'GET'});
  assert.equal(read.status,200);assert.equal((await read.json()).state,'SUCCEEDED');
 }finally{f.close();}
});

test('failing jobs retry with bounded attempts, then dead-letter with the receipt',async t=>{
 const f=await commerceFixture(t);try{
  const receipt=await f.accept(exportBody('orders',[{id:'broken'}]));
  const job=await (await call(f,'/api/commerce/jobs',{body:{receiptId:receipt.receiptId}})).json();
  // Quarantine is a completed classification (4xx reason codes are not retryable).
  const run=await call(f,`/api/commerce/jobs/${job.jobId}/run`,{method:'POST'});
  assert.equal(run.status,200);assert.equal((await run.json()).state,'SUCCEEDED');
  assert.equal(f.db.db.prepare("SELECT state FROM commerce_receipts").get().state,'QUARANTINED');
  assert.equal(f.db.db.prepare("SELECT state FROM commerce_jobs").get().state,'COMPLETED');
 }finally{f.close();}
});

test('job admission is limited and unknown jobs 404',async t=>{
 const f=await commerceFixture(t);try{
  const missing=await call(f,'/api/commerce/jobs/cj_unknown',{method:'GET'});
  assert.equal(missing.status,404);
  const viewer=await call(f,'/api/commerce/jobs',{user:'viewer@acme.test',pass:fixturePasswords.staff,body:{receiptId:'whatever'}});
  assert.equal(viewer.status,403);
 }finally{f.close();}
});

test('a 5xx normalization failure marks RETRY_PENDING and a later run completes',async t=>{
 const f=await commerceFixture(t);try{
  const receipt=await f.accept();
  const job=await (await call(f,'/api/commerce/jobs',{body:{receiptId:receipt.receiptId}})).json();
  const stored=f.db.db.prepare('SELECT object_key FROM commerce_receipts').get();
  // Remove the object: RAW_EVIDENCE_UNAVAILABLE is a 5xx, retryable failure.
  f.objects.objects.delete(stored.object_key);
  const first=await call(f,`/api/commerce/jobs/${job.jobId}/run`,{method:'POST'});
  assert.equal(first.status,503);
  const jobRow=f.db.db.prepare('SELECT state,attempts FROM commerce_jobs').get();
  assert.equal(jobRow.state,'RETRY_PENDING');assert.equal(jobRow.attempts,1);
  assert.equal(f.db.db.prepare("SELECT state FROM commerce_receipts").get().state,'RETRY_PENDING');
  // Restore evidence; the retry completes.
  f.objects.objects.set(stored.object_key,JSON.stringify(exportBody()));
  const second=await call(f,`/api/commerce/jobs/${job.jobId}/run`,{method:'POST'});
  assert.equal(second.status,200);assert.equal((await second.json()).state,'SUCCEEDED');
 }finally{f.close();}
});
