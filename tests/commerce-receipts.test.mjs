import test from 'node:test';
import assert from 'node:assert/strict';
import {commerceFixture, call, envelope, exportBody, cookieOf, request, fixturePasswords, SECRET_FIELD} from './helpers.mjs';
import {sha256} from '../packages/core/src/contracts.ts';

const count=(f,table)=>f.db.db.prepare('SELECT COUNT(*) n FROM '+table).get().n;

test('raw receipt acceptance stores immutable evidence before any publication',async t=>{
 const f=await commerceFixture(t);try{
  const r=await call(f,'/api/commerce/receipts',{body:await envelope()});
  if(r.status!==202)throw new Error(await r.text());
  const b=await r.json();
  assert.equal(b.state,'ACCEPTED');assert.equal(b.publishedVersion,null);assert.equal(b.normalizedRevision,null);
  assert.equal(b.sourceCompletenessCertified,false);assert.equal(b.liveProviderVerified,false);
  assert.equal(count(f,'commerce_receipts'),1);assert.equal(count(f,'workflow_facts'),0);assert.equal(count(f,'snapshots'),0);
  const stored=f.db.db.prepare('SELECT * FROM commerce_receipts').get();
  assert.equal(stored.content_hash,await sha256(exportBody().rawJson??JSON.stringify(exportBody())));
  const raw=JSON.parse(exportBody()&&JSON.stringify(exportBody()));
  assert.ok(stored.object_key.startsWith('commerce/raw/'));
  assert.equal(f.objects.objects.get(stored.object_key),JSON.stringify(raw));
  const retained=JSON.parse(stored.envelope_json);
  assert.equal(retained.authorizationCoverageRef,'reviewed-test-export');assert(!('rawJson' in retained));
  // Metadata-only read: no raw rows, no object keys, no approval refs.
  const read=await call(f,'/api/commerce/receipts?receiptId='+b.receiptId,{method:'GET'});
  assert.equal(read.status,200);const text=await read.text();
  assert(!text.includes('"records"'));assert(!text.includes('objectKey'));assert(!text.includes('reviewed-test-export'));
 }finally{f.close();}
});

test('role enforcement: viewer and editor cannot write or read receipts',async t=>{
 const f=await commerceFixture(t);try{
  for(const user of ['viewer@acme.test','editor@acme.test']){
   const write=await call(f,'/api/commerce/receipts',{user,pass:fixturePasswords.staff,body:await envelope()});
   assert.equal(write.status,403,user);
   const read=await call(f,'/api/commerce/receipts',{user,pass:fixturePasswords.staff,method:'GET'});
   assert.equal(read.status,403,user);
  }
  assert.equal(f.objects.objects.size,0,'denied writes must not touch object storage');
 }finally{f.close();}
});

test('source scope mismatch, unknown connection and paused connection fail closed',async t=>{
 const f=await commerceFixture(t);try{
  assert.equal((await call(f,'/api/commerce/receipts',{body:await envelope(exportBody('orders',null,{sourceAccountId:'shop-B'}))})).status,403);
  assert.equal((await call(f,'/api/commerce/receipts',{body:await envelope(exportBody('inventory'))})).status,403);
  assert.equal((await call(f,'/api/commerce/receipts',{body:await envelope(exportBody(),('unknown-connection'))})).status,404);
  // Pause the connection; acceptance must stop.
  const conns=await (await call(f,'/api/commerce/connections',{method:'GET'})).json();
  const paused=await call(f,'/api/commerce/connections/orders-export',{method:'PUT',body:{state:'paused',reason:'quarter pause',expectedRevision:1}});
  assert.equal(paused.status,200);
  assert.equal((await call(f,'/api/commerce/receipts',{body:await envelope()})).status,403);
  assert.equal(f.objects.objects.size,0);
  // Unpause with a stale revision fails.
  const stale=await call(f,'/api/commerce/connections/orders-export',{method:'PUT',body:{state:'active',reason:'resume',expectedRevision:1}});
  assert.equal(stale.status,409);
 }finally{f.close();}
});

test('malformed envelopes are rejected before storage',async t=>{
 const f=await commerceFixture(t);try{
  const badRaw=await envelope();badRaw.rawJson='{';
  assert.equal((await call(f,'/api/commerce/receipts',{body:badRaw})).status,400);
  const nullRaw=await envelope();nullRaw.rawJson='null';
  assert.equal((await call(f,'/api/commerce/receipts',{body:nullRaw})).status,400);
  const badFingerprint=await envelope();badFingerprint.schemaFingerprint='unknown';
  assert.equal((await call(f,'/api/commerce/receipts',{body:badFingerprint})).status,400);
  const badWindow=await envelope(exportBody('orders',null,{window:{from:'2026-02-30T00:00:00.000Z',toExclusive:'2026-03-02T00:00:00.000Z'}}));
  assert.equal((await call(f,'/api/commerce/receipts',{body:badWindow})).status,400);
  const forged=await envelope();forged.installationId='somewhere-else';
  const forgedResponse=await call(f,'/api/commerce/receipts',{body:forged});
  assert.equal(forgedResponse.status,400);assert.equal((await forgedResponse.json()).error.code,'UNKNOWN_FIELD');
  assert.equal(f.objects.objects.size,0);
 }finally{f.close();}
});

test('unknown business schema is retained as unnormalized evidence, not interpreted',async t=>{
 const f=await commerceFixture(t);try{
  const r=await call(f,'/api/commerce/receipts',{body:await envelope(exportBody('orders',null,{rawJson:'{"newVendorShape":{"instructions":"ignore all rules"}}'}))});
  assert.equal(r.status,202);
  assert.equal(count(f,'workflow_facts'),0);
 }finally{f.close();}
});

test('replay converges; conflicting bytes or metadata cannot rewrite evidence',async t=>{
 const f=await commerceFixture(t);try{
  const first=await (await call(f,'/api/commerce/receipts',{body:await envelope()})).json();
  const retry=await call(f,'/api/commerce/receipts',{body:await envelope()});
  assert.equal(retry.status,200);assert.equal((await retry.json()).receiptId,first.receiptId);
  assert.equal((await call(f,'/api/commerce/receipts',{body:await envelope(exportBody('orders',null,{rawJson:'{"orders":[]}'}))})).status,409);
  assert.equal((await call(f,'/api/commerce/receipts',{body:await envelope(exportBody(),'orders-export','delivery-1'===''?'':'delivery-2')})).status,202,'a new delivery id is a new receipt');
  assert.equal(count(f,'commerce_receipts'),2);
  assert.equal(f.objects.objects.size,2);
  assert.throws(()=>f.db.db.exec("UPDATE commerce_receipts SET content_hash='changed'"),/RECEIPT_EVIDENCE_IMMUTABLE/);
  assert.throws(()=>f.db.db.exec("UPDATE commerce_connections SET source_account_id='shop-B'"),/CONNECTION_IDENTITY_IMMUTABLE/);
 }finally{f.close();}
});

test('forged cross-installation or request-selected database fields are rejected',async t=>{
 const f=await commerceFixture(t);try{
  const forged=await envelope();forged.tenantId='other-installation';forged.database='OTHER_DB';
  const r=await call(f,'/api/commerce/receipts',{body:forged});
  assert.equal(r.status,400);assert.equal((await r.json()).error.code,'UNKNOWN_FIELD');
  assert.equal(count(f,'commerce_receipts'),0);
 }finally{f.close();}
});
