import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {allocateMinor,businessDay,commerceSchemaFingerprint,minor,normalizeCommerceExport,orderMetrics,quantity,quantityUnits,formatQuantity,ratio,settlementMetrics,sourceKey} from '../packages/core/commerce-model.ts';
import {normalizeCommerceReceipt} from '../apps/api/src/commerce-normalization.ts';
import {commerceFixture,envelope,exportBody,order,settlement,stock} from './commerce-helpers.mjs';
const scope=async(raw)=>({...await envelope(raw),tenantId:'alpha',provider:raw.provider});
const cases=JSON.parse(await readFile(new URL('../docs/specs/fixtures/commerce-golden-cases.json',import.meta.url),'utf8')).cases;
for(const fixture of cases.filter(c=>c.kind==='margin'))test(`runtime ${fixture.id}`,()=>{
 const x=fixture.input,r=orderMetrics([order({merchandise:x.merchandise,sellerDiscount:x.seller_discount,merchandiseReversal:x.merchandise_reversal,cogs:x.cogs,variableFees:x.variable_fees})]);
 assert.equal(r.net_merchandise_sales,fixture.expected.net_sales);assert.equal(r.gross_profit,fixture.expected.gross_profit);assert.equal(r.contribution_pre_ads,fixture.expected.contribution_pre_ads);
});
for(const fixture of cases.filter(c=>c.kind==='settlement'))test(`runtime ${fixture.id}`,()=>{
 const r=settlementMetrics([settlement({components:fixture.input.components.map((amount,i)=>({id:String(i),kind:'adjustment',amount})),receipts:fixture.input.receipts.map((amount,i)=>({id:String(i),amount,evidenceRef:'bank',observedAt:'2026-09-11T00:00:00.000Z'}))})]);
 assert.equal(r.expected_settlement,fixture.expected.expected_payout);assert.equal(r.observed_cash_received,fixture.expected.matched_receipts);assert.equal(r.unreconciled_payout_amount,fixture.expected.gap);assert.equal(r.recorded_recovery,'0');
});
test('C09 exact largest-remainder allocation is order independent and signed',()=>{
 const c=cases.find(c=>c.kind==='allocation');assert.deepEqual(allocateMinor(c.input.minor_units,c.input.lines),c.expected);
 assert.deepEqual(allocateMinor('10',[...c.input.lines].reverse()),c.expected);assert.deepEqual(allocateMinor('-10',c.input.lines),{A:'-4',B:'-3',C:'-3'});
 assert.throws(()=>allocateMinor('1',[{id:'a',weight:'0'}]));assert.throws(()=>allocateMinor('1',[{id:'a',weight:'1'},{id:'a',weight:'1'}]));
});
test('C09 ratio of sums and undefined/negative/tie cases are exact',()=>{
 assert.equal(ratio('150','1100'),'0.136364');assert.equal(ratio('0','0'),null);assert.equal(ratio('-1','2',0),'-1');assert.equal(ratio('1','3'), '0.333333');assert.equal(ratio('0','-3'),'0.000000');
 const n='999999999999999999999999999999';assert.equal(orderMetrics([order({merchandise:n,sellerDiscount:'0',merchandiseReversal:'0'}),order({id:'second',merchandise:n,sellerDiscount:'0',merchandiseReversal:'0'})]).net_merchandise_sales,(BigInt(n)*2n).toString());
});
test('C09 decimal quantity parsing and VND reject floats/exponents/noncanonical identifiers',()=>{
 assert.equal(quantity('10.123400'),'10.1234');assert.equal(formatQuantity(quantityUnits('-10.1234')),'-10.1234');
 for(const v of [1.2,'1.2','1e3','01','-0',NaN,Infinity])assert.throws(()=>minor(v));
 assert.throws(()=>quantity('1.1234567'));assert.throws(()=>quantity('-0.0000'));
});
test('C09-A05 Vietnam midnight maps correctly',()=>{
 assert.equal(businessDay('2026-08-31T16:59:59.000Z'),'2026-08-31');assert.equal(businessDay('2026-08-31T17:00:00.000Z'),'2026-09-01');
});
test('C07 string IDs survive; reconnect stable; identical IDs in different shops separate',async()=>{
 const raw=exportBody(),s=await scope(raw),n=await normalizeCommerceExport(raw,s);assert.equal(n.orders[0].id,'9007199254740993');
 assert.equal(await sourceKey({...s,connectionId:'new'},n.orders[0].id),n.orders[0].sourceKey);
 assert.notEqual(await sourceKey({...s,sourceAccountId:'shop-B'},n.orders[0].id),n.orders[0].sourceKey);
 await assert.rejects(normalizeCommerceExport(exportBody('orders',[order({id:9007199254740993})]),s));
});
test('C06 normalized stage preserves raw and never advances publication',async t=>{
 const f=await commerceFixture(t),r=await f.accept(),response=await f.normalize(r.receiptId);assert.equal(response.status,200);const n=await response.json();assert.equal(n.state,'NORMALIZED');assert.equal(n.recordCount,1);assert.equal(n.published,false);
 const row=f.env.TENANT_A.db.prepare('SELECT * FROM commerce_receipts').get();assert.equal(row.normalized_revision,n.normalizationId);assert.equal(row.published_version,null);assert.equal(f.env.SOURCES.objects.size,3);
 const stored=f.env.TENANT_A.db.prepare('SELECT payload_json FROM commerce_normalizations').get();assert.equal(JSON.parse(stored.payload_json).orders[0].cogs,'400000');
 assert.throws(()=>f.env.TENANT_A.db.prepare("UPDATE commerce_normalizations SET content_hash='bad'").run(),/IMMUTABLE/);
});
test('C06 normalization replay and concurrent consumption converge without duplicate audit',async t=>{
 const f=await commerceFixture(t),r=await f.accept();const results=await Promise.all([f.normalize(r.receiptId),f.normalize(r.receiptId)]);assert(results.every(r=>r.status===200));
 assert.equal(f.env.TENANT_A.db.prepare('SELECT COUNT(*) AS n FROM commerce_normalizations').get().n,1);assert.equal(f.env.TENANT_A.db.prepare("SELECT COUNT(*) AS n FROM audit_events WHERE event_type='commerce.normalized'").get().n,1);
 const repeat=await (await f.normalize(r.receiptId)).json();assert.equal(repeat.replayed,true);
});
test('C06-A04 unknown fingerprint quarantines without deleting raw evidence',async t=>{
 const f=await commerceFixture(t),b=await envelope();b.schemaFingerprint='sha256:'+'f'.repeat(64);const r=await(await f.call('commerce-receipts',b)).json();const n=await(await f.normalize(r.receiptId)).json();
 assert.equal(n.state,'QUARANTINED');assert.equal(n.reasonCode,'UNSUPPORTED_COMMERCE_SCHEMA');assert.equal(f.env.TENANT_A.db.prepare('SELECT normalized_revision FROM commerce_receipts').get().normalized_revision,null);
 assert(f.env.SOURCES.objects.has(f.env.TENANT_A.db.prepare('SELECT object_key FROM commerce_receipts').get().object_key));
});
for(const [label,modify,code] of [
 ['source identity',b=>{b.sourceAccountId='other';},'EMBEDDED_SOURCE_SCOPE_MISMATCH'],
 ['time window',b=>{b.window={...b.window,from:'2026-09-02T00:00:00.000Z'};},'EMBEDDED_WINDOW_MISMATCH'],
 ['missing cost evidence',b=>{b.records[0].cogsEvidenceRef=null;},'HISTORICAL_COGS_EVIDENCE_REQUIRED'],
 ['fractional VND',b=>{b.records[0].merchandise='1.5';},'INVALID_EXACT_MONEY'],
 ['duplicate identity',b=>{b.records.push({...b.records[0]});},'DUPLICATE_SOURCE_OBJECT'],
 ['unknown state recognized',b=>{b.records[0].state='unknown';},'UNKNOWN_STATE_CANNOT_RECOGNIZE'],
 ['outside window',b=>{b.records[0].orderedAt=b.window.toExclusive;},'RECORD_OUTSIDE_EXPORT_WINDOW'],
 ['future observation',b=>{b.observedAt='2099-01-01T00:00:00.000Z';},'FUTURE_EXPORT_OBSERVATION'],
 ['unknown field',b=>{b.sql='SELECT secret';},'UNKNOWN_FIELD']
])test(`normalizer quarantines ${label}`,async t=>{
 const f=await commerceFixture(t),raw=exportBody(),b=await envelope(raw);modify(raw);b.rawJson=JSON.stringify(raw);
 const r=await(await f.call('commerce-receipts',b)).json();const n=await(await f.normalize(r.receiptId)).json();assert.equal(n.state,'QUARANTINED');assert.equal(n.reasonCode,code);
});
test('retained legacy receipts without explicit event type require reviewed reimport',async()=>{
 const raw=exportBody(),s=await scope(raw);delete s.eventType;await assert.rejects(normalizeCommerceExport(raw,s),{code:'EXPLICIT_SNAPSHOT_REQUIRED'});
});
test('C13 supplied available remains 10 despite reserved 3; advertised stock stays marked',async()=>{
 const raw=exportBody('inventory',[stock(),stock({id:'listing',kind:'advertised'})]),n=await normalizeCommerceExport(raw,await scope(raw));assert.equal(n.inventory[1].available,'10');assert.equal(n.inventory[0].kind,'advertised');
});
test('C12 signed reserve bridge remains distinct from cash; duplicate allocations reject',async()=>{
 const raw=exportBody('settlements'),s=await scope(raw),n=await normalizeCommerceExport(raw,s);assert.equal(settlementMetrics(n.settlements).expected_settlement,'520000');
 raw.records.push(settlement({id:'second'}));await assert.rejects(normalizeCommerceExport(raw,s),{code:'RECEIPT_ALLOCATED_TWICE'});
});
for(const user of ['alpha-viewer','alpha-editor','beta-owner','platform-admin'])test(`normalization denies ${user} before raw get`,async t=>{
 const f=await commerceFixture(t),r=await f.accept();f.env.SOURCES.get=async()=>{throw new Error('must not read');};const res=await f.call('commerce-normalizations',{receiptId:r.receiptId},{user});assert.equal(res.status,403);
});
test('cross-tenant build IDs and revoked source are not accessible for processing',async t=>{
 const f=await commerceFixture(t),r=await f.accept();await f.normalize(r.receiptId);const other=await f.api(new Request('http://localhost:8787/api/tenants/beta/commerce-normalizations/'+(await(await f.call('commerce-normalizations')).json()).normalizations[0].normalizationId,{headers:{'x-demo-user':'beta-owner'}}),f.env);assert.equal(other.status,404);
 f.env.TENANT_A.db.exec("UPDATE commerce_connections SET state='revoked',revision=revision+1");assert.equal((await f.normalize(r.receiptId)).status,403);
});
for(const mode of ['missing','tamper','oversize'])test(`raw ${mode} never advances normalized checkpoint`,async t=>{
 const f=await commerceFixture(t),r=await f.accept();f.env.SOURCES.get=async()=>mode==='missing'?null:{size:mode==='oversize'?50000:2,text:async()=>'{}'};
 assert.equal((await f.normalize(r.receiptId)).status,503);assert.equal(f.env.TENANT_A.db.prepare('SELECT state FROM commerce_receipts').get().state,'ACCEPTED');
});
for(const mode of ['source','route'])test(`normalization ${mode} revocation during raw read fences transaction`,async t=>{
 const f=await commerceFixture(t),r=await f.accept(),original=f.env.SOURCES.get.bind(f.env.SOURCES);f.env.SOURCES.get=async key=>{const raw=await original(key);f.env.TENANT_A.db.exec(mode==='source'?"UPDATE commerce_connections SET state='revoked',revision=revision+1":"UPDATE tenant_identity SET route_epoch=route_epoch+1");return raw;};
 assert.equal((await f.normalize(r.receiptId)).status,409);assert.equal(f.env.TENANT_A.db.prepare('SELECT COUNT(*) AS n FROM commerce_normalizations').get().n,0);
});
test('normalization database failure rolls back build, checkpoint and audit',async t=>{
 const f=await commerceFixture(t),r=await f.accept();f.env.TENANT_A.db.exec("CREATE TRIGGER fail_normalized BEFORE UPDATE OF normalized_revision ON commerce_receipts BEGIN SELECT RAISE(ABORT,'fault'); END");
 assert.equal((await f.normalize(r.receiptId)).status,500);assert.equal(f.env.TENANT_A.db.prepare('SELECT COUNT(*) AS n FROM commerce_normalizations').get().n,0);
 f.env.TENANT_A.db.exec('DROP TRIGGER fail_normalized');assert.equal((await f.normalize(r.receiptId)).status,200);
});

test('C09 tax basis must be explicit and does not invent a legal VAT rate',async()=>{
 const raw=exportBody(),s=await scope(raw);delete raw.taxBasis;await assert.rejects(normalizeCommerceExport(raw,s),{code:'EXPLICIT_TAX_BASIS_REQUIRED'});
 raw.taxBasis='vat-assumed-10pct';await assert.rejects(normalizeCommerceExport(raw,s),{code:'EXPLICIT_TAX_BASIS_REQUIRED'});
});
test('C09 earned shipping and subsidies are separate; unknown components block contribution',()=>{
 assert.equal(orderMetrics([order({shippingIncome:'50000',earnedSubsidy:'20000'})]).contribution_pre_ads,'310000');
 assert.equal(orderMetrics([order({shippingIncome:null})]).contribution_pre_ads,null);
 assert.equal(orderMetrics([order({earnedSubsidy:null})]).contribution_pre_ads,null);
 assert.equal(orderMetrics([order({earnedSubsidy:null})]).gross_profit,'320000');
});
