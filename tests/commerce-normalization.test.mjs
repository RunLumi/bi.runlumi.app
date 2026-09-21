import test from 'node:test';
import assert from 'node:assert/strict';
import {commerceFixture, call, exportBody, fixturePasswords, SECRET_FIELD} from './helpers.mjs';
import {sha256} from '../packages/core/src/contracts.ts';

test('normalization reads retained evidence, verifies integrity, and stores a versioned build',async t=>{
 const f=await commerceFixture(t);try{
  const receipt=await f.accept();
  const r=await f.normalize(receipt.receiptId);
  assert.equal(r.status,201);const build=await r.json();
  assert.equal(build.state,'NORMALIZED');assert.equal(build.recordCount,1);assert.equal(build.reasonCode,null);
  assert.equal(build.published,false);assert.equal(build.sourceCompletenessCertified,false);
  assert.equal(f.db.db.prepare('SELECT payload_json FROM commerce_normalizations').get().payload_json.includes('so_'),true,'normalized rows carry stable source keys');
  const stored=f.db.db.prepare('SELECT * FROM commerce_receipts').get();
  assert.equal(stored.state,'NORMALIZED');assert.equal(stored.normalized_revision,build.normalizationId);
  // Replay returns the same build.
  const replay=await f.normalize(receipt.receiptId);
  assert.equal(replay.status,200);assert.equal((await replay.json()).normalizationId,build.normalizationId);
  // Metadata list does not expose payload rows.
  const list=await call(f,'/api/commerce/normalizations',{method:'GET'});
  assert.equal(list.status,200);assert(!JSON.stringify(await list.json()).includes('sourceKey'));
 }finally{f.close();}
});

test('invalid business content is quarantined with a stable reason, never zero-filled',async t=>{
 const f=await commerceFixture(t);try{
  const receipt=await f.accept(exportBody('orders',[{id:'broken'}]));
  const r=await f.normalize(receipt.receiptId);
  assert.equal(r.status,201);const build=await r.json();
  assert.equal(build.state,'QUARANTINED');
  assert.match(build.reasonCode,/^(?:UNKNOWN_|INVALID_|DUPLICATE_|COMMERCE_RECORD_LIMIT|EXPLICIT_|UNSUPPORTED_|EMBEDDED_|FUTURE_|RECORD_OUTSIDE_WINDOW)/);
  assert.equal(f.db.db.prepare('SELECT COUNT(*) n FROM workflow_facts').get().n,0);
  const stored=f.db.db.prepare('SELECT state FROM commerce_receipts').get();
  assert.equal(stored.state,'QUARANTINED');
 }finally{f.close();}
});

test('tampered object storage breaks integrity and fails closed',async t=>{
 const f=await commerceFixture(t);try{
  const receipt=await f.accept();
  const stored=f.db.db.prepare('SELECT object_key FROM commerce_receipts').get();
  f.objects.objects.set(stored.object_key,'{"orders":tampered}');
  const r=await f.normalize(receipt.receiptId);
  assert.equal(r.status,503);assert.equal((await r.json()).error.code,'RAW_EVIDENCE_INTEGRITY');
  assert.equal(f.db.db.prepare('SELECT COUNT(*) n FROM commerce_normalizations').get().n,0);
 }finally{f.close();}
});

test('staging inspection exposes only normalized owner-scoped builds',async t=>{
 const f=await commerceFixture(t);try{
  const receipt=await f.accept();
  const build=await (await f.normalize(receipt.receiptId)).json();
  const staging=await call(f,`/api/commerce/staging/${build.normalizationId}`,{method:'GET'});
  assert.equal(staging.status,200);const body=await staging.json();
  assert.equal(body.published,false);assert.equal(body.data.resourceType,'orders');
  // Editor cannot inspect staging.
  const denied=await call(f,`/api/commerce/staging/${build.normalizationId}`,{user:'editor@acme.test',pass:fixturePasswords.staff,method:'GET'});
  assert.equal(denied.status,403);
  // Unknown staging id is a plain 404.
  const missing=await call(f,'/api/commerce/staging/nb_unknown',{method:'GET'});
  assert.equal(missing.status,404);
 }finally{f.close();}
});

test('revoked sources are unavailable to normalization',async t=>{
 const f=await commerceFixture(t);try{
  const receipt=await f.accept();
  await call(f,'/api/commerce/connections/orders-export',{method:'PUT',body:{state:'revoked',reason:'access withdrawn',expectedRevision:1}});
  const r=await f.normalize(receipt.receiptId);
  assert.equal(r.status,403);assert.equal((await r.json()).error.code,'RECEIPT_SCOPE_UNAVAILABLE');
 }finally{f.close();}
});
