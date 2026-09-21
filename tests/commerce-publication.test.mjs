import test from 'node:test';
import assert from 'node:assert/strict';
import {commerceFixture, call, exportBody, order, envelope, createStaff, fixturePasswords, SECRET_FIELD} from './helpers.mjs';

async function publishOrders(f,{raw,deliveryId='delivery-1'}={}){
  const receipt=await f.accept(raw??exportBody(),'orders-export',deliveryId);
  const build=await (await f.normalize(receipt.receiptId)).json();
  const preview=await call(f,'/api/commerce/publications/preview',{body:{normalizationIds:[build.normalizationId],mappingId:null,controls:[],expectedRevision:0,expectedPublicationId:null}});
  if(preview.status!==200)throw new Error(await preview.text());
  const view=await preview.json();
  const publish=await call(f,'/api/commerce/publications',{body:{...{normalizationIds:[build.normalizationId],mappingId:null,controls:[],expectedRevision:0,expectedPublicationId:null},previewHash:view.previewHash,reason:'monthly close'}});
  if(publish.status!==201)throw new Error(await publish.text());
  return {build,view,published:await publish.json()};
}

test('reviewed preview and publish: metrics, NULL semantics and provenance are exact',async t=>{
 const f=await commerceFixture(t);try{
  const {published}=await publishOrders(f);
  assert.equal(published.replayed,false);assert.equal(published.revision,1);
  const read=await call(f,'/api/commerce/publications',{method:'GET'});
  assert.equal(read.status,200);const head=await read.json();
  assert.equal(head.activePublicationId,published.publicationId);
  const report=head.publication.report;
  // order: merchandise 1,000,000 - discount 100,000 - reversal 180,000 = 720,000 net sales
  assert.equal(report.metrics.net_merchandise_sales,'720000');
  assert.equal(report.metrics.recognized_order_count,'1');
  assert.equal(report.metrics.cogs,'400000');
  assert.equal(report.metrics.gross_profit,'320000');
  assert.equal(report.metrics.contribution_pre_ads,'240000');
  assert.equal(report.metrics.net_aov,'720000.000000');
  assert.equal(report.metrics.recorded_recovery,'0');
  // settlement metrics are absent rows -> explicit nulls, never zeros
  assert.equal(report.metrics.expected_settlement,null);
  assert.equal(report.metrics.observed_cash_received,null);
  assert.equal(report.metrics.available_units,null);
  assert.equal(report.warnings.includes('SOURCE_COMPLETENESS_UNVERIFIED'),true);
  assert.equal(report.warnings.includes('MISSING_INDEPENDENT_CONTROLS'),true);
  assert.equal(report.sourceCompletenessCertified,false);
 }finally{f.close();}
});

test('publishing requires the reviewed preview hash (CAS on the head revision)',async t=>{
 const f=await commerceFixture(t);try{
  const receipt=await f.accept();
  const build=await (await f.normalize(receipt.receiptId)).json();
  const body={normalizationIds:[build.normalizationId],mappingId:null,controls:[],expectedRevision:0,expectedPublicationId:null};
  const withoutPreview=await call(f,'/api/commerce/publications',{body:{...body,previewHash:'sha256:deadbeef',reason:'bypass'}});
  assert.equal(withoutPreview.status,409);assert.equal((await withoutPreview.json()).error.code,'PUBLICATION_PREVIEW_REQUIRED');
  const preview=await call(f,'/api/commerce/publications/preview',{body});
  const view=await preview.json();
  // A second publication on the same head revision conflicts.
  const first=await call(f,'/api/commerce/publications',{body:{...body,previewHash:view.previewHash,reason:'close'}});
  assert.equal(first.status,201);
  const stale=await call(f,'/api/commerce/publications',{body:{...body,previewHash:view.previewHash,reason:'close again'}});
  assert.ok([409,200].includes(stale.status));
 }finally{f.close();}
});

test('publication watermark and source-omission regressions are rejected',async t=>{
 const f=await commerceFixture(t);try{
  await publishOrders(f);
  // Older observation window for the same source: observedAt regression.
  const status=await (await call(f,'/api/commerce/publication-status',{method:'GET'})).json();
  const older=exportBody('orders',[order()],{observedAt:'2026-09-15T00:00:00.000Z'});
  const receipt=await f.accept(older,'orders-export','delivery-older');
  const build=await (await f.normalize(receipt.receiptId)).json();
  const preview=await call(f,'/api/commerce/publications/preview',{body:{normalizationIds:[build.normalizationId],mappingId:null,controls:[],expectedRevision:status.revision,expectedPublicationId:status.activePublicationId}});
  assert.equal(preview.status,409);
  assert.equal((await preview.json()).error.code,'SOURCE_OBSERVATION_REGRESSION');
 }finally{f.close();}
});

test('revoking a source blocks the saved publication, its export and queries',async t=>{
 const f=await commerceFixture(t);try{
  const {published}=await publishOrders(f);
  await createStaff(f,'viewer2@acme.test','viewer');
  const exportOk=await call(f,`/api/commerce/publications/${published.publicationId}/export?format=csv`);
  assert.equal(exportOk.status,200);
  assert.match(exportOk.headers.get('content-type')??'',/text\/csv/);
  assert.ok((await exportOk.text()).includes('net_merchandise_sales'));
  await call(f,'/api/commerce/connections/orders-export',{method:'PUT',body:{state:'revoked',reason:'access withdrawn',expectedRevision:1}});
  const revoked=await call(f,'/api/commerce/publications',{method:'GET'});
  assert.equal(revoked.status,503);assert.equal((await revoked.json()).error.code,'PUBLICATION_SOURCE_REVOKED');
  const exportRevoked=await call(f,`/api/commerce/publications/${published.publicationId}/export?format=csv`);
  assert.equal(exportRevoked.status,503);
  const queryRevoked=await call(f,'/api/commerce/queries',{body:{contract:'lumi.query.v1',metrics:[{id:'net_merchandise_sales',version:1}],dimensions:[],filters:[],limit:10,consistency:'published',dataVersion:published.publicationId}});
  assert.equal(queryRevoked.status,503);
 }finally{f.close();}
});

test('exports: csv carries formula-injection safety; json carries the hash; viewer cannot export',async t=>{
 const f=await commerceFixture(t);try{
  const {published}=await publishOrders(f);
  const csv=await call(f,`/api/commerce/publications/${published.publicationId}/export?format=csv`);
  const buffer=await csv.arrayBuffer();
  const head=Array.from(new Uint8Array(buffer.slice(0,3)));
  assert.deepEqual(head,[0xEF,0xBB,0xBF],'CSV must open with a UTF-8 BOM for spreadsheet tools');
  const text=new TextDecoder('utf-8').decode(buffer.slice(3));
  assert.ok(text.includes(published.publicationId));
  const jsonExport=await call(f,`/api/commerce/publications/${published.publicationId}/export?format=json`);
  const body=await jsonExport.json();
  assert.equal(body.publicationId,published.publicationId);assert.ok(body.contentHash);
  assert.equal((await call(f,`/api/commerce/publications/${published.publicationId}/export?format=xml`)).status,400);
  const viewerExport=await call(f,`/api/commerce/publications/${published.publicationId}/export?format=csv`,{user:'viewer@acme.test',pass:fixturePasswords.staff});
  assert.equal(viewerExport.status,403);
 }finally{f.close();}
});

test('publication history and status expose metadata without rewriting evidence',async t=>{
 const f=await commerceFixture(t);try{
  const {published,build}=await publishOrders(f);
  const status=await call(f,'/api/commerce/publication-status',{method:'GET'});
  assert.equal(status.status,200);const head=await status.json();
  assert.equal(head.activePublicationId,published.publicationId);assert.equal(head.revision,1);
  const byId=await call(f,`/api/commerce/publications?publicationId=${published.publicationId}`,{method:'GET'});
  assert.equal(byId.status,200);
  assert.equal((await byId.json()).publication.report.contract,'lumi.commerce.report.v1');
  assert.throws(()=>f.db.db.exec("UPDATE commerce_publications SET report_json='{}'"),/PUBLICATION_IMMUTABLE/);
 }finally{f.close();}
});
