import test from 'node:test';
import assert from 'node:assert/strict';
import {assembleCommerceReport} from '../packages/core/commerce-report.ts';
import {normalizeCommerceExport} from '../packages/core/commerce-model.ts';
import {publishCommerce} from '../apps/api/src/commerce-publication.ts';
import {commerceFixture,envelope,exportBody,order,stock,settlement} from './commerce-helpers.mjs';
import {request} from '../scripts/local-adapters.mjs';
async function build(f,raw=exportBody(),connection='orders-export',delivery='delivery-1'){
 const r=await f.accept(raw,connection,delivery),res=await f.normalize(r.receiptId),n=await res.json();assert.equal(n.state,'NORMALIZED',JSON.stringify(n));return n;
}
const bodyFor=(ids,extra={})=>({normalizationIds:ids,mappingId:null,controls:[],expectedRevision:0,expectedPublicationId:null,...extra});
async function preview(f,body){const r=await f.call('commerce-publications/preview',body);const p=await r.json();assert.equal(r.status,200,JSON.stringify(p));return p;}
async function publish(f,body){const p=await preview(f,body),r=await f.call('commerce-publications',{...body,previewHash:p.previewHash,reason:'Reviewed bounded synthetic scope'}),v=await r.json();assert.equal(r.status,201,JSON.stringify(v));return v;}
async function pureInput(raw,normalizationId='nb_1') {const e=await envelope(raw);return {normalizationId,receiptId:'cr_1',contentHash:'hash',rawContentHash:'raw-hash',data:await normalizeCommerceExport(raw,{...e,tenantId:'alpha',provider:raw.provider})};}

test('source -> receipt -> normalized -> reviewed publication -> same exact API money',async t=>{
 const f=await commerceFixture(t),n=await build(f),b=bodyFor([n.normalizationId]);const before=await(await f.call('commerce-publications')).json();assert.equal(before.noPublishedData,true);
 const p=await preview(f,b);assert.equal(p.report.metrics.net_merchandise_sales,'720000');assert.equal(p.report.metrics.gross_profit,'320000');assert.equal(p.report.metrics.contribution_pre_ads,'240000');
 assert.equal(f.env.TENANT_A.db.prepare('SELECT COUNT(*) AS n FROM commerce_publications').get().n,0);
 const published=await publish(f,b),read=await(await f.call('commerce-publications')).json();assert.equal(read.publication.id,published.publicationId);assert.deepEqual(read.publication.report,p.report);
 assert.equal(read.publication.report.sourceCompletenessCertified,false);assert.equal(read.publication.report.merchantVerified,false);assert.equal(read.publication.report.qualityState,'PROVISIONAL');
 assert.equal(f.env.TENANT_A.db.prepare('SELECT state FROM commerce_receipts').get().state,'PUBLISHED');
 assert.throws(()=>f.env.TENANT_A.db.exec("UPDATE commerce_publications SET content_hash='wrong'"),/IMMUTABLE/);
 assert.throws(()=>f.env.TENANT_A.db.exec('DELETE FROM commerce_normalizations'),/FOREIGN KEY/);
});
test('publication requires the exact reviewed preview hash and expected head',async t=>{
 const f=await commerceFixture(t),n=await build(f),b=bodyFor([n.normalizationId]);assert.equal((await f.call('commerce-publications',{...b,previewHash:'wrong',reason:'review'})).status,409);
 const published=await publish(f,b);assert.equal(published.revision,1);const repeat=await publish(f,b);assert.equal(repeat.replayed,true);
 assert.equal((await f.call('commerce-publications/preview',{...b,expectedRevision:50})).status,409);
 assert.equal(f.env.TENANT_A.db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE event_type='commerce.published'").get().n,1);
});
test('C06-A06 concurrent identical publications converge without duplicated manifest inputs',async t=>{
 const f=await commerceFixture(t),n=await build(f),b=bodyFor([n.normalizationId]),p=await preview(f,b),input={...b,previewHash:p.previewHash,reason:'review'};
 const results=await Promise.all([f.call('commerce-publications',input),f.call('commerce-publications',input)]);assert(results.every(r=>r.status===201));assert.equal(f.env.TENANT_A.db.prepare('SELECT revision FROM commerce_heads').get().revision,1);
 assert.equal(f.env.TENANT_A.db.prepare('SELECT COUNT(*) AS n FROM commerce_publication_inputs').get().n,1);
});
test('competing distinct publications have one revision winner',async t=>{
 const f=await commerceFixture(t),a=await build(f),b=await build(f,exportBody('orders',[order({merchandise:'2000000'})]),'orders-export','new');const ba=bodyFor([a.normalizationId]),bb=bodyFor([b.normalizationId]),pa=await preview(f,ba),pb=await preview(f,bb);
 const responses=await Promise.all([f.call('commerce-publications',{...ba,previewHash:pa.previewHash,reason:'a'}),f.call('commerce-publications',{...bb,previewHash:pb.previewHash,reason:'b'})]);assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);assert.equal(f.env.TENANT_A.db.prepare('SELECT COUNT(*) AS n FROM commerce_publications').get().n,1);
});
test('C08-A01 a missing source record fails independent declared controls despite successful transport',async t=>{
 const f=await commerceFixture(t),n=await build(f),control={normalizationId:n.normalizationId,recordCount:2,netSales:'1440000',expectedSettlement:null,evidenceRef:'separate-source-control'};
 assert.equal((await f.call('commerce-publications/preview',bodyFor([n.normalizationId],{controls:[control]}))).status,422);
 const ok=await preview(f,bodyFor([n.normalizationId],{controls:[{...control,recordCount:1,netSales:'720000'}]}));assert.equal(ok.report.checks[0].passed,true);assert.equal(ok.report.checks[0].independence,'owner-declared-not-verified');assert.equal(ok.report.sourceCompletenessCertified,false);
});
test('missing controls are unverified, never an invented 100 percent',async t=>{
 const f=await commerceFixture(t),n=await build(f),p=await preview(f,bodyFor([n.normalizationId]));assert(p.report.warnings.includes('MISSING_INDEPENDENT_CONTROLS'));assert.equal(p.report.checks.length,0);
});
test('C07-A01 reviewed Shopee/OMS identities produce one order and retain both observations',async t=>{
 const f=await commerceFixture(t);f.connect('shopee-export','orders','shopee','shop-S');f.connect('nhanh-export','orders','nhanh','shop-N');
 const a=await build(f,exportBody('orders',[order({id:'S1'})],{provider:'shopee',sourceAccountId:'shop-S'}),'shopee-export','s');
 const b=await build(f,exportBody('orders',[order({id:'N1'})],{provider:'nhanh',sourceAccountId:'shop-N'}),'nhanh-export','n');const ids=[a.normalizationId,b.normalizationId];
 assert.equal((await f.call('commerce-publications/preview',bodyFor(ids))).status,422);
 const payloads=f.env.TENANT_A.db.prepare('SELECT payload_json FROM commerce_normalizations').all().map(r=>JSON.parse(r.payload_json));
 const mapping=await(await f.call('commerce-mappings',{evidenceRef:'reviewed-explicit-source-crossref',entries:payloads.map(d=>({sourceKey:d.orders[0].sourceKey,canonicalId:'order-one',priority:0}))})).json();
 const p=await preview(f,bodyFor(ids,{mappingId:mapping.mappingId}));assert.equal(p.report.metrics.recognized_order_count,'1');assert.equal(p.report.metrics.net_merchandise_sales,'720000');assert.equal(p.report.exclusions.length,1);assert.equal(p.report.sources.length,2);
});
test('equal amounts with distinct source identities remain two orders',async()=>{
 const input=await pureInput(exportBody('orders',[order({id:'one'}),order({id:'two'})]));const report=assembleCommerceReport([input],null,[]);assert.equal(report.metrics.recognized_order_count,'2');assert.equal(report.metrics.net_merchandise_sales,'1440000');
});
test('source authority ties on disagreeing money block; explicit priority resolves with visible exclusion',async()=>{
 const a=await pureInput(exportBody('orders',[order({id:'one'})]),'nb_1'),b=await pureInput(exportBody('orders',[order({id:'two',merchandise:'2000000'})],{sourceAccountId:'shop-B'}),'nb_2');const mapping={evidenceRef:'reviewed',entries:[{sourceKey:a.data.orders[0].sourceKey,canonicalId:'same',priority:0},{sourceKey:b.data.orders[0].sourceKey,canonicalId:'same',priority:0}]};
 assert.throws(()=>assembleCommerceReport([a,b],mapping,[]),{code:'UNRESOLVED_SOURCE_AUTHORITY'});mapping.entries[1].priority=1;const r=assembleCommerceReport([a,b],mapping,[]);assert.equal(r.metrics.net_merchandise_sales,'720000');assert(r.warnings.includes('SOURCE_AUTHORITY_DIFFERENCE'));
});
test('C07 snapshot reconnection is not a second source and cannot overlap in one publication',async t=>{
 const f=await commerceFixture(t);f.connect('replacement');const a=await build(f),b=await build(f,exportBody(),'replacement','reconnect');assert.equal((await f.call('commerce-publications/preview',bodyFor([a.normalizationId,b.normalizationId]))).status,422);
});
test('C09 missing cost/fees stay unavailable through published report',async t=>{
 const f=await commerceFixture(t),n=await build(f,exportBody('orders',[order({cogs:null,cogsEvidenceRef:null,variableFees:null})]));await publish(f,bodyFor([n.normalizationId]));const r=(await(await f.call('commerce-publications')).json()).publication.report;assert.equal(r.metrics.net_merchandise_sales,'720000');assert.equal(r.metrics.gross_profit,null);assert.equal(r.metrics.contribution_pre_ads,null);
});
test('C09-A08 historical correction creates new version; old manifest retains old cost and money',async t=>{
 const f=await commerceFixture(t),n=await build(f),one=await publish(f,bodyFor([n.normalizationId]));const next=await build(f,exportBody('orders',[order({cogs:'450000',cogsEvidenceRef:'reviewed-restatement'})],{observedAt:'2026-09-19T01:00:00.000Z'}),'orders-export','corrected');
 const two=await publish(f,bodyFor([next.normalizationId],{expectedRevision:1,expectedPublicationId:one.publicationId}));assert.notEqual(one.publicationId,two.publicationId);
 const old=await(await f.call('commerce-publications/'+one.publicationId)).json(),current=await(await f.call('commerce-publications')).json();assert.equal(old.publication.report.metrics.gross_profit,'320000');assert.equal(current.publication.report.metrics.gross_profit,'270000');
});
test('C06 stale source observations and omission cannot replace active publication',async t=>{
 const f=await commerceFixture(t),a=await build(f),pub=await publish(f,bodyFor([a.normalizationId]));const older=await build(f,exportBody('orders',[order({merchandise:'2000000'})],{observedAt:'2026-09-18T00:00:00.000Z'}),'orders-export','old');
 assert.equal((await f.call('commerce-publications/preview',bodyFor([older.normalizationId],{expectedRevision:1,expectedPublicationId:pub.publicationId}))).status,409);
 f.connect('stock-export','inventory');const b=await build(f,exportBody('inventory'),'stock-export','stock');assert.equal((await f.call('commerce-publications/preview',bodyFor([b.normalizationId],{expectedRevision:1,expectedPublicationId:pub.publicationId}))).status,409);
});
test('C12 payout and observed cash stay separate; a 20000 gap is not recovery',async t=>{
 const f=await commerceFixture(t);f.connect('settlements-export','settlements');const n=await build(f,exportBody('settlements'),'settlements-export','s');const p=await preview(f,bodyFor([n.normalizationId]));assert.equal(p.report.metrics.expected_settlement,'520000');assert.equal(p.report.metrics.observed_cash_received,'500000');assert.equal(p.report.metrics.unreconciled_payout_amount,'20000');assert.equal(p.report.metrics.recorded_recovery,'0');
});
test('provisional statements cannot create final expected payout',async()=>{
 const n=await pureInput(exportBody('settlements',[settlement({finality:'provisional'})]));const r=assembleCommerceReport([n],null,[]);assert.equal(r.metrics.expected_settlement,null);assert.equal(r.metrics.provisionalStatements,1);assert.equal(r.metrics.observed_cash_received,'500000');
});
test('C13 same physical pool across time is a gauge; advertised stock is never additive',async()=>{
 const n=await pureInput(exportBody('inventory',[stock({id:'yesterday',available:'12',observedAt:'2026-09-17T00:00:00.000Z'}),stock({id:'today'}),stock({id:'copy'}),stock({id:'listing',kind:'advertised',available:'100'}),stock({id:'other',poolId:'warehouse-2',available:'5'})]));const r=assembleCommerceReport([n],null,[]);assert.equal(r.metrics.available_units,'15');assert.equal(r.inventory.length,2);assert(r.warnings.includes('ADVERTISED_STOCK_EXCLUDED'));
});
test('conflicting same-instant stock gauges block publication',async()=>{
 const n=await pureInput(exportBody('inventory',[stock(),stock({id:'bad',available:'8'})]));assert.throws(()=>assembleCommerceReport([n],null,[]),{code:'CONFLICTING_STOCK_GAUGE'});
});
test('missing stock is null, negative stock remains visible',async()=>{
 const missing=await pureInput(exportBody('inventory',[stock({available:null})]));assert.equal(assembleCommerceReport([missing],null,[]).metrics.available_units,null);
 const negative=await pureInput(exportBody('inventory',[stock({available:'-1.5'})]));const r=assembleCommerceReport([negative],null,[]);assert.equal(r.metrics.available_units,'-1.5');assert(r.warnings.includes('NEGATIVE_STOCK'));
});
for(const user of ['alpha-viewer','alpha-editor','beta-owner','platform-admin'])test(`publication and mapping deny ${user}`,async t=>{
 const f=await commerceFixture(t),n=await build(f);for(const [path,body] of [['commerce-publications',undefined],['commerce-publications/preview',bodyFor([n.normalizationId])],['commerce-mappings',{evidenceRef:'test',entries:[]}]])assert.equal((await f.call(path,body,{user})).status,403);
});
test('tenant B cannot read tenant A publication ID or use its normalization/mapping',async t=>{
 const f=await commerceFixture(t),n=await build(f),pub=await publish(f,bodyFor([n.normalizationId]));const read=await f.api(request('/api/tenants/beta/commerce-publications/'+pub.publicationId,{user:'beta-owner'}),f.env);assert.equal(read.status,404);
 const b=await f.api(request('/api/tenants/beta/commerce-publications/preview',{user:'beta-owner',method:'POST',body:bodyFor([n.normalizationId])}),f.env);assert.equal(b.status,409);
});
test('publication checksum corruption fails closed instead of falling back',async t=>{
 const f=await commerceFixture(t),n=await build(f);await publish(f,bodyFor([n.normalizationId]));f.env.TENANT_A.db.exec("DROP TRIGGER commerce_publication_immutable; UPDATE commerce_publications SET report_json='{}'");assert.equal((await f.call('commerce-publications')).status,503);
});
test('transaction failure cannot publish a partially linked manifest',async t=>{
 const f=await commerceFixture(t),n=await build(f),b=bodyFor([n.normalizationId]),p=await preview(f,b);f.env.TENANT_A.db.exec("CREATE TRIGGER fault_publish BEFORE UPDATE ON commerce_heads BEGIN SELECT RAISE(ABORT,'fault'); END");
 assert.equal((await f.call('commerce-publications',{...b,previewHash:p.previewHash,reason:'review'})).status,500);assert.equal(f.env.TENANT_A.db.prepare('SELECT COUNT(*) AS n FROM commerce_publications').get().n,0);assert.equal(f.env.TENANT_A.db.prepare('SELECT COUNT(*) AS n FROM commerce_publication_inputs').get().n,0);
});
for(const mode of ['source','route'])test(`${mode} changes between preview and publish never activate candidate`,async t=>{
 const f=await commerceFixture(t),n=await build(f),b=bodyFor([n.normalizationId]),p=await preview(f,b);f.env.TENANT_A.db.exec(mode==='source'?"UPDATE commerce_connections SET state='revoked',revision=revision+1":"UPDATE tenant_identity SET route_epoch=route_epoch+1");
 assert.notEqual((await f.call('commerce-publications',{...b,previewHash:p.previewHash,reason:'review'})).status,201);assert.equal(f.env.TENANT_A.db.prepare('SELECT COUNT(*) AS n FROM commerce_publications').get().n,0);
});
test('C06 concurrent readers see whole predecessor or successor report with matching hashes',async t=>{
 const f=await commerceFixture(t),a=await build(f),one=await publish(f,bodyFor([a.normalizationId]));const b=await build(f,exportBody('orders',[order({merchandise:'2000000'})],{observedAt:'2026-09-19T01:00:00.000Z'}),'orders-export','new');const body=bodyFor([b.normalizationId],{expectedRevision:1,expectedPublicationId:one.publicationId}),p=await preview(f,body);
 const [, ...reads]=await Promise.all([f.call('commerce-publications',{...body,previewHash:p.previewHash,reason:'review'}),...Array.from({length:8},()=>f.call('commerce-publications').then(r=>r.json()))]);
 for(const read of reads){const m=read.publication.report.metrics;assert(['720000','1720000'].includes(m.net_merchandise_sales));assert.equal((BigInt(m.net_merchandise_sales)-BigInt(m.cogs)).toString(),m.gross_profit);assert.equal(read.publication.id,read.activePublicationId);}
});

test('retained reports cannot bypass a revoked source approval',async t=>{
 const f=await commerceFixture(t),n=await build(f),pub=await publish(f,bodyFor([n.normalizationId]));
 f.env.TENANT_A.db.exec("UPDATE commerce_connections SET state='revoked',revision=revision+1");
 for(const path of ['commerce-publications','commerce-publications/'+pub.publicationId]){const r=await f.call(path);assert.equal(r.status,503);assert.equal((await r.json()).error.code,'PUBLICATION_SOURCE_REVOKED');}
});

test('owner can inspect staged source identities without publishing; source revocation still blocks it',async t=>{
 const f=await commerceFixture(t),n=await build(f),response=await f.call('commerce-staging/'+n.normalizationId),view=await response.json();assert.equal(response.status,200);assert.equal(view.published,false);assert.match(view.data.orders[0].sourceKey,/^so_[a-f0-9]{48}$/);
 assert.equal((await f.call('commerce-staging/'+n.normalizationId,undefined,{user:'alpha-viewer'})).status,403);
 f.env.TENANT_A.db.exec("UPDATE commerce_connections SET state='revoked',revision=revision+1");assert.equal((await f.call('commerce-staging/'+n.normalizationId)).status,404);
});
test('metadata-only publication status permits pinning a repair after source revocation',async t=>{
 const f=await commerceFixture(t),n=await build(f),p=await publish(f,bodyFor([n.normalizationId]));f.env.TENANT_A.db.exec("UPDATE commerce_connections SET state='revoked',revision=revision+1");
 const r=await f.call('commerce-publications/status');assert.equal(r.status,200);assert.deepEqual(await r.json(),{activePublicationId:p.publicationId,revision:1});
 assert.equal((await f.call('commerce-publications/status',undefined,{user:'alpha-viewer'})).status,403);
});
