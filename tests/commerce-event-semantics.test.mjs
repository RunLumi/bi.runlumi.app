import test from 'node:test';
import assert from 'node:assert/strict';
import {parseExportEnvelope} from '@runlumi/core/commerce-envelope.ts';
import {acceptCommerceExport} from '@runlumi/core/commerce-receipts.ts';
import {fixture} from '../scripts/local-adapters.mjs';
const input=()=>({connectionId:'orders',sourceAccountId:'shop-A',resourceType:'orders',deliveryId:'d1',sourceObjectId:'export',sourceRevision:null,sourceEventAt:null,sourceUpdatedAt:null,window:{from:'2026-09-01T00:00:00.000Z',toExclusive:'2026-09-02T00:00:00.000Z'},schemaFingerprint:'sha256:'+'a'.repeat(64),rawJson:'{"orders":[]}'});
test('export transport assigns explicit snapshot semantics, including legacy-shaped inputs',()=>{
 assert.equal(parseExportEnvelope(input()).eventType,'snapshot');
 assert.deepEqual(parseExportEnvelope(input()),parseExportEnvelope({...input(),eventType:'snapshot'}));
 for(const eventType of ['delete','upsert','correction','unknown',null])assert.throws(()=>parseExportEnvelope({...input(),eventType}),e=>e.code==='UNSUPPORTED_EXPORT_EVENT_TYPE');
});
test('snapshot semantics survive durable envelope and fingerprint; unsupported delta never writes',async()=>{
 const f=await fixture({seed:false});try{
  f.env.TENANT_A.db.exec("INSERT INTO commerce_connections VALUES ('alpha','orders','generic','shop-A','orders','authorized-export','review','active',1)");
  const ctx={id:'alpha',role:'owner',features:['data.import'],db:f.env.TENANT_A,principal:{issuer:'local-demo',subject:'alpha-owner'},active:null,routeEpoch:1};
  await assert.rejects(acceptCommerceExport(ctx,f.env.SOURCES,{...input(),eventType:'delete'}),e=>e.code==='UNSUPPORTED_EXPORT_EVENT_TYPE');
  assert.equal(f.env.SOURCES.objects.size,0);
  await acceptCommerceExport(ctx,f.env.SOURCES,input());
  const row=f.env.TENANT_A.db.prepare('SELECT envelope_json FROM commerce_receipts').get();
  assert.equal(JSON.parse(row.envelope_json).eventType,'snapshot');
  assert.equal((await acceptCommerceExport(ctx,f.env.SOURCES,{...input(),eventType:'snapshot'})).replayed,true);
 }finally{f.close();}
});
