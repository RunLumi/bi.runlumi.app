import test from 'node:test';
import assert from 'node:assert/strict';
import {minor,quantity,quantityUnits,formatQuantity,sumMinor,ratio,allocateMinor,businessDay,orderMetrics,settlementMetrics} from '../packages/core/src/commerce-model.ts';
import {parseExportEnvelope} from '../packages/core/src/commerce-envelope.ts';
import {exportBody,order,settlement,stock} from './helpers.mjs';
import {commerceSchemaFingerprint} from '../packages/core/src/commerce-model.ts';

test('exact money: canonical integer strings, signed, no epsilon drift',async()=>{
 assert.equal(minor('0'),'0');assert.equal(minor('-1000'),'-1000');
 assert.equal(minor('9007199254740993'),'9007199254740993','beyond Number SAFE_INTEGER');
 assert.equal(sumMinor(['9007199254740993','1']),'9007199254740994','exact BigInt summation');
 assert.equal(sumMinor(['0.5'.replace('.5','')]),'0');
 for(const bad of ['1.5','1e3','+1','',' 1','01'])assert.throws(()=>minor(bad),e=>e.code==='INVALID_EXACT_MONEY',bad);
 assert.throws(()=>minor('-5',true),e=>e.code==='INVALID_EXACT_MONEY');
});

test('exact quantities: 6 decimal places, BigInt-backed, canonical formatting',async()=>{
 assert.equal(quantityUnits('13.5'),13_500_000n);
 assert.equal(quantityUnits('-0.000001'),-1n);
 assert.equal(formatQuantity(13_500_000n),'13.5');
 assert.equal(formatQuantity(-1n),'-0.000001');
 assert.equal(quantity('13.500000'),'13.5','trailing zeros are canonicalized');
 assert.throws(()=>quantity('0.0000001'),e=>e.code==='INVALID_EXACT_QUANTITY','7 decimals exceed the contract');
 assert.throws(()=>quantity('-0'),e=>e.code==='INVALID_EXACT_QUANTITY');
});

test('ratio is exact with half-away-from-zero rounding and null denominators',async()=>{
 assert.equal(ratio('720000','3'),'240000.000000');
 assert.equal(ratio('1','3'),'0.333333');
 assert.equal(ratio('-1','3'),'-0.333333');
 assert.equal(ratio('2','3'),'0.666667','half away from zero rounds up');
 assert.equal(ratio('-2','3'),'-0.666667');
 assert.equal(ratio('5','0'),null,'undefined ratios are null, never epsilon-clamped');
 assert.throws(()=>ratio('x','1'),e=>e.code==='INVALID_RATIO_INPUT');
});

test('allocateMinor preserves the total exactly (largest remainder, deterministic ties)',async()=>{
 const parts=allocateMinor('100',[{id:'a',weight:'1'},{id:'b',weight:'1'},{id:'c',weight:'1'}]);
 assert.equal(sumMinor(Object.values(parts)),'100');
 assert.deepEqual(parts,{a:'34',b:'33',c:'33'},'larger remainder and id order break ties');
 const negative=allocateMinor('-100',[{id:'a',weight:'1'},{id:'b',weight:'1'}]);
 assert.equal(sumMinor(Object.values(negative)),'-100');
 assert.throws(()=>allocateMinor('10',[{id:'a',weight:'0'}]),e=>e.code==='ZERO_ALLOCATION_WEIGHT');
});

test('order metrics: recognized cohort only; missing components yield nulls, not zeros',async()=>{
 const full=orderMetrics([order()]);
 assert.deepEqual(full,{recognized_order_count:'1',net_merchandise_sales:'720000',cogs:'400000',gross_profit:'320000',contribution_pre_ads:'240000',net_aov:'720000.000000',missingCogs:0,missingFees:0,missingIncome:0});
 const noCogs=orderMetrics([order({cogs:null,cogsEvidenceRef:null})]);
 assert.equal(noCogs.cogs,null);assert.equal(noCogs.gross_profit,null);assert.equal(noCogs.contribution_pre_ads,null);
 assert.equal(noCogs.net_merchandise_sales,'720000','sales remain computable');
 assert.equal(noCogs.missingCogs,1);
 const cancelled=orderMetrics([order({state:'cancelled',recognizedAt:null,merchandiseReversal:'0'})]);
 assert.equal(cancelled.recognized_order_count,'0','cancelled orders are outside the recognized cohort');
 assert.equal(cancelled.net_merchandise_sales,null);
});

test('settlement metrics distinguish expected, observed and reconciled amounts',async()=>{
 const final=settlementMetrics([settlement()]);
 assert.equal(final.expected_settlement,'520000');
 assert.equal(final.observed_cash_received,'500000');
 assert.equal(final.unreconciled_payout_amount,'20000');
 assert.equal(final.recorded_recovery,'0','no recovered cash is claimed without outcome evidence');
 const provisional=settlementMetrics([settlement({finality:'provisional'})]);
 assert.equal(provisional.expected_settlement,null,'provisional statements are not expected values');
 assert.equal(provisional.provisionalStatements,1);
});

test('business day is Asia/Ho_Chi_Minh local',async()=>{
 assert.equal(businessDay('2026-09-01T17:00:00.000Z'),'2026-09-02','17:00Z is the next day in UTC+7');
 assert.equal(businessDay('2026-09-01T16:59:59.999Z'),'2026-09-01');
});

test('envelope parsing bounds raw exports and rejects unbounded input',async()=>{
 const fingerprint=await commerceSchemaFingerprint();
 const good={eventType:'snapshot',connectionId:'c',sourceAccountId:'a',resourceType:'orders',deliveryId:'d1',sourceObjectId:'o',sourceRevision:null,sourceEventAt:null,sourceUpdatedAt:null,window:{from:'2026-09-01T00:00:00.000Z',toExclusive:'2026-09-02T00:00:00.000Z'},schemaFingerprint:fingerprint,rawJson:JSON.stringify(exportBody())};
 const parsed=parseExportEnvelope(good);
 assert.equal(parsed.eventType,'snapshot');
 assert.throws(()=>parseExportEnvelope({...good,eventType:'delta'}),e=>e.code==='UNSUPPORTED_EXPORT_EVENT_TYPE','implicit deltas are never accepted');
 const big='{"orders":['+'x'.repeat(49_000)+']}';
 assert.throws(()=>parseExportEnvelope({...good,rawJson:big}),e=>e.code==='RAW_EXPORT_TOO_LARGE');
});
