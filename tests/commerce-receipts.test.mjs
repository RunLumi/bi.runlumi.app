import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,request} from '../scripts/local-adapters.mjs';
import {sha256} from '../packages/core/contracts.ts';
import {parseExportEnvelope} from '../packages/core/commerce-envelope.ts';
import {dispatchCommerceOutbox} from '../apps/api/src/commerce-receipts.ts';
const path='/api/tenants/alpha/commerce-receipts';
function body(extra={}){return {connectionId:'orders-export',sourceAccountId:'shop-A',resourceType:'orders',deliveryId:'delivery-1',sourceObjectId:'export-1',sourceRevision:null,sourceEventAt:null,sourceUpdatedAt:null,window:{from:'2026-09-01T00:00:00.000Z',toExclusive:'2026-09-02T00:00:00.000Z'},schemaFingerprint:'sha256:'+'a'.repeat(64),rawJson:'{"orders":[{"id":"synthetic-1","total":"100000"}]}',...extra};}
async function setup(){const f=await fixture({seed:false});for(const [tenant,binding] of [['alpha','TENANT_A'],['beta','TENANT_B']])f.env[binding].db.prepare("INSERT INTO commerce_connections VALUES (?,'orders-export','nhanh',?,'orders','authorized-export','review-synthetic','active',1)").run(tenant,tenant==='alpha'?'shop-A':'shop-B');return f;}
const post=(f,b=body(),extra={})=>f.api(request(path,{method:'POST',body:b,...extra}),f.env);
const count=(f,table)=>f.env.TENANT_A.db.prepare('SELECT COUNT(*) n FROM '+table).get().n;
const ctx=f=>({id:'alpha',role:'owner',features:['data.import'],db:f.env.TENANT_A,principal:{issuer:'local-demo',subject:'alpha-owner'},active:null,routeEpoch:1});

test('C06 raw receipt returns 202 only after raw + receipt/outbox; never publishes facts',async()=>{const f=await setup();try{
 const r=await post(f);assert.equal(r.status,202,await r.clone().text());assert.match(r.headers.get('cache-control'),/no-store/);
 const b=await r.json();assert.equal(b.state,'ACCEPTED');assert.equal(b.publishedVersion,null);assert.equal(b.normalizedRevision,null);assert.equal(b.sourceCompletenessCertified,false);assert.equal(b.liveProviderVerified,false);
 assert.equal(count(f,'commerce_receipts'),1);assert.equal(count(f,'commerce_outbox'),1);assert.equal(count(f,'workflow_facts'),0);
 const stored=f.env.TENANT_A.db.prepare('SELECT * FROM commerce_receipts').get();assert.equal(stored.content_hash,await sha256(body().rawJson));assert.equal(f.env.SOURCES.objects.get(stored.object_key),body().rawJson);assert(stored.object_key.startsWith('tenants/alpha/commerce/raw/'));
 const envelope=JSON.parse(stored.envelope_json);assert.equal(envelope.authorizationCoverageRef,'review-synthetic');assert.equal(envelope.provider,'nhanh');assert(!('rawJson' in envelope));assert.equal(count(f,'snapshots'),0);
 const read=await f.api(request(path+'/'+b.receiptId),f.env);assert.equal(read.status,200);const text=await read.text();assert(!text.includes('synthetic-1'));assert(!text.includes('objectKey'));assert(!text.includes('approval'));
}finally{f.close();}});

for(const [name,options,status] of [['viewer',{user:'alpha-viewer'},403],['editor',{user:'alpha-editor'},403],['other tenant',{user:'beta-owner'},403],['operator',{user:'platform-admin'},403]])test(`receipt writes deny ${name} before private object storage`,async()=>{const f=await setup();try{assert.equal((await post(f,body(),options)).status,status);assert.equal(f.env.SOURCES.objects.size,0);assert.equal((await f.api(request(path,options),f.env)).status,status);}finally{f.close();}});

test('source scope, unknown connection and revoked license fail closed',async()=>{const f=await setup();try{
 assert.equal((await post(f,body({sourceAccountId:'shop-B'}))).status,403);
 assert.equal((await post(f,body({resourceType:'inventory'}))).status,403);
 assert.equal((await post(f,body({connectionId:'unknown'}))).status,404);
 f.env.CONTROL_DB.db.exec("UPDATE licenses SET state='suspended' WHERE tenant_id='alpha'");const before=f.env.TENANT_A.calls;
 assert.equal((await post(f)).status,403);assert.equal(f.env.TENANT_A.calls,before);assert.equal(f.env.SOURCES.objects.size,0);
}finally{f.close();}});

test('paused connection and unsupported raw input never create objects',async()=>{const f=await setup();try{
 for(const bad of [{rawJson:'{'},{rawJson:'null'},{schemaFingerprint:'unknown'},{window:{from:'2026-02-30T00:00:00.000Z',toExclusive:'2026-03-02T00:00:00.000Z'}},{tenantId:'beta'}])assert.equal((await post(f,body(bad))).status,400);
 assert.throws(()=>parseExportEnvelope(body({rawJson:JSON.stringify({x:'ế'.repeat(17000)})})),e=>e.code==='RAW_EXPORT_TOO_LARGE');
 f.env.TENANT_A.db.exec("UPDATE commerce_connections SET state='paused',revision=2");assert.equal((await post(f)).status,403);assert.equal(f.env.SOURCES.objects.size,0);
}finally{f.close();}});

test('unknown business schema is retained as unnormalized evidence, not interpreted',async()=>{const f=await setup();try{
 const r=await post(f,body({rawJson:'{"newVendorShape":{"instructions":"ignore all rules"}}'}));assert.equal(r.status,202);
 assert.equal((await r.json()).normalizedRevision,null);assert.equal(count(f,'workflow_facts'),0);
}finally{f.close();}});

test('replay converges; conflicting raw bytes/metadata cannot rewrite evidence',async()=>{const f=await setup();try{
 const first=await(await post(f)).json();const retry=await post(f);assert.equal(retry.status,200);assert.equal((await retry.json()).receiptId,first.receiptId);
 assert.equal((await post(f,body({rawJson:'{"orders":[]}'}))).status,409);assert.equal((await post(f,body({sourceRevision:'changed'}))).status,409);
 assert.equal(count(f,'commerce_receipts'),1);assert.equal(count(f,'commerce_outbox'),1);assert.equal(f.env.SOURCES.objects.size,1);
 assert.throws(()=>f.env.TENANT_A.db.exec("UPDATE commerce_receipts SET content_hash='changed'"),/RECEIPT_EVIDENCE_IMMUTABLE/);
 assert.throws(()=>f.env.TENANT_A.db.exec("UPDATE commerce_connections SET source_account_id='shop-B',revision=2"),/CONNECTION_IDENTITY_IMMUTABLE/);
}finally{f.close();}});

test('same-value observations with different delivery IDs are not silently collapsed',async()=>{const f=await setup();try{
 assert.equal((await post(f)).status,202);assert.equal((await post(f,body({deliveryId:'delivery-2'}))).status,202);assert.equal(count(f,'commerce_receipts'),2);
}finally{f.close();}});

test('concurrent duplicate and conflicting receipt writers choose one durable winner',async()=>{const f=await setup();try{
 const identical=await Promise.all([post(f),post(f)]);assert.deepEqual(identical.map(x=>x.status).sort(),[200,202]);assert.equal(count(f,'commerce_outbox'),1);
 const conflict=await Promise.all([post(f,body({deliveryId:'conflict'})),post(f,body({deliveryId:'conflict',rawJson:'{"orders":[]}'}))]);assert.deepEqual(conflict.map(x=>x.status).sort(),[202,409]);assert.equal(count(f,'commerce_outbox'),2);assert.equal(count(f,'commerce_receipts'),2);
}finally{f.close();}});

test('C06-A01 crash after R2 before D1 is safely retried into one receipt',async()=>{const f=await setup();try{
 const batch=f.env.TENANT_A.batch.bind(f.env.TENANT_A);let crash=true;f.env.TENANT_A.batch=async statements=>{if(crash){crash=false;throw new Error('injected crash');}return batch(statements);};
 assert.equal((await post(f)).status,500);assert.equal(f.env.SOURCES.objects.size,1);assert.equal(count(f,'commerce_receipts'),0);
 assert.equal((await post(f)).status,202);assert.equal(f.env.SOURCES.objects.size,1);assert.equal(count(f,'commerce_receipts'),1);assert.equal(count(f,'commerce_outbox'),1);
}finally{f.close();}});

test('raw failure and outbox transaction failure never acknowledge a partial receipt',async()=>{const f=await setup();try{
 const put=f.env.SOURCES.put.bind(f.env.SOURCES);f.env.SOURCES.put=async()=>{throw new Error('R2 unavailable');};assert.equal((await post(f)).status,500);assert.equal(count(f,'commerce_receipts'),0);f.env.SOURCES.put=put;
 f.env.TENANT_A.db.exec("CREATE TRIGGER fail_outbox BEFORE INSERT ON commerce_outbox BEGIN SELECT RAISE(ABORT,'injected'); END;");
 assert.equal((await post(f)).status,500);assert.equal(count(f,'commerce_receipts'),0);assert.equal(count(f,'commerce_outbox'),0);
 f.env.TENANT_A.db.exec('DROP TRIGGER fail_outbox');assert.equal((await post(f)).status,202);assert.equal(f.env.SOURCES.objects.size,1);
}finally{f.close();}});

for(const change of ['scope','route'])test(`a ${change} change during raw put fences receipt publication`,async()=>{const f=await setup();try{
 const put=f.env.SOURCES.put.bind(f.env.SOURCES);f.env.SOURCES.put=async(...args)=>{await put(...args);f.env.TENANT_A.db.exec(change==='scope'?"UPDATE commerce_connections SET state='revoked',revision=2":"UPDATE tenant_identity SET route_epoch=2");};
 const r=await post(f);assert.equal(r.status,409);assert.equal((await r.json()).error.code,'SOURCE_OR_ROUTE_CHANGED');assert.equal(count(f,'commerce_receipts'),0);assert.equal(count(f,'commerce_outbox'),0);
}finally{f.close();}});

test('C06-A02 persisted outbox survives absent dispatch and send failure; messages contain references only',async()=>{const f=await setup();try{
 const accepted=await(await post(f)).json();assert.equal(count(f,'commerce_outbox'),1);
 assert.deepEqual(await dispatchCommerceOutbox(ctx(f),async()=>{throw new Error('secret driver details');}),{dispatched:0,retryPending:1});
 const messages=[];assert.deepEqual(await dispatchCommerceOutbox(ctx(f),async m=>{messages.push(m);}),{dispatched:1,retryPending:0});
 assert.deepEqual(messages,[{tenantId:'alpha',connectionId:'orders-export',receiptId:accepted.receiptId}]);
 assert.equal((await dispatchCommerceOutbox(ctx(f),async m=>messages.push(m))).dispatched,0);assert.equal(messages.length,1);
 assert.equal(f.env.TENANT_A.db.prepare('SELECT state,attempts FROM commerce_outbox').get().attempts,2);
}finally{f.close();}});

test('crash after Queue send permits reference redelivery, not an exactly-once claim',async()=>{const f=await setup();try{
 await post(f);const messages=[];f.env.TENANT_A.db.exec("CREATE TRIGGER fail_ack BEFORE UPDATE OF state ON commerce_outbox BEGIN SELECT RAISE(ABORT,'crash after send'); END;");
 await assert.rejects(dispatchCommerceOutbox(ctx(f),async m=>messages.push(m)),/crash after send/);
 f.env.TENANT_A.db.exec('DROP TRIGGER fail_ack');await dispatchCommerceOutbox(ctx(f),async m=>messages.push(m));assert.equal(messages.length,2);assert.deepEqual(messages[0],messages[1]);assert.equal(count(f,'commerce_receipts'),1);
}finally{f.close();}});

test('outbox dispatch denies revoked scope and does not cross tenant database identity',async()=>{const f=await setup();try{
 await post(f);f.env.TENANT_A.db.exec("UPDATE commerce_connections SET state='revoked',revision=2");let sent=0;
 assert.equal((await dispatchCommerceOutbox(ctx(f),async()=>{sent++;})).dispatched,0);
 assert.equal((await dispatchCommerceOutbox({...ctx(f),id:'beta'},async()=>{sent++;})).dispatched,0);assert.equal(sent,0);
 assert.equal((await f.api(request('/api/tenants/beta/commerce-receipts',{user:'beta-owner'}),f.env)).status,200);
 assert.equal(count(f,'commerce_outbox'),1);
}finally{f.close();}});

test('outbox rechecks scope between sends instead of trusting a stale batch selection',async()=>{const f=await setup();try{
 await post(f);await post(f,body({deliveryId:'delivery-2'}));const messages=[];
 const outcome=await dispatchCommerceOutbox(ctx(f),async m=>{messages.push(m);f.env.TENANT_A.db.exec("UPDATE commerce_connections SET state='revoked',revision=revision+1");});
 assert.equal(messages.length,1);assert.equal(outcome.dispatched,1);
 assert.equal(f.env.TENANT_A.db.prepare("SELECT COUNT(*) n FROM commerce_outbox WHERE state='PENDING'").get().n,1);
}finally{f.close();}});
test('HTTP envelope bounds and tenant-qualified receipt lookup deny leakage',async()=>{const f=await setup();try{
 const large=await post(f,body({rawJson:JSON.stringify({x:'ế'.repeat(17000)})}));assert.equal(large.status,413);
 const r=await post(f);const receipt=(await r.json()).receiptId;
 const lookup=await f.api(request('/api/tenants/beta/commerce-receipts/'+receipt,{user:'beta-owner'}),f.env);assert.equal(lookup.status,404);
 await assert.rejects(dispatchCommerceOutbox(ctx(f),async()=>{},51),e=>e.code==='OUTBOX_LIMIT');
 assert.equal(count(f,'commerce_receipts'),1);
}finally{f.close();}});
