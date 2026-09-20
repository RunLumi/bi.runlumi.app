import {AppError,object,sha256,text} from './contracts.ts';

/** Versioned, deliberately narrow interchange contract. Not a vendor API schema. */
export const COMMERCE_CONTRACT='lumi.commerce.export.v1';
export const NORMALIZER_VERSION='commerce-export-v1.0.0';
export const TAX_BASIS='net-merchandise-actual-cash-v1';
export const SEMANTIC_VERSION='commerce-cohort-v1.0.0';
export const MAX_COMMERCE_RECORDS=100;
export const schemaDescriptor={
  contract:COMMERCE_CONTRACT,normalizer:NORMALIZER_VERSION,currency:'VND',taxBasis:TAX_BASIS,quantityScale:6,
  timezone:'Asia/Ho_Chi_Minh',recognition:'fulfilled-order-cohort-v1',
  header:['contract','provider','sourceAccountId','resourceType','currency','taxBasis','timezone','window','observedAt','records'],
  orders:['id','orderedAt','recognizedAt','state','merchandise','sellerDiscount','merchandiseReversal','cogs','cogsEvidenceRef','variableFees','shippingIncome','earnedSubsidy'],
  settlements:['id','economicAt','dueAt','finality','components','receipts'],
  component:['id','kind','amount'],receipt:['id','observedAt','amount','evidenceRef'],
  inventory:['id','poolId','variantId','kind','observedAt','onHand','reserved','available'],
  money:'canonical integer decimal string, signed <=30 digits; VND minor unit is dong',
  quantity:'canonical signed decimal string <=12 integral and <=6 fractional digits',
  time:'canonical UTC milliseconds; lower-inclusive upper-exclusive windows',
} as const;
export async function commerceSchemaFingerprint(){return 'sha256:'+await sha256(JSON.stringify(schemaDescriptor));}
export type Resource='orders'|'settlements'|'inventory';
export type Provider='nhanh'|'haravan'|'shopee'|'generic';
export interface SourceScope {tenantId:string;provider:string;sourceAccountId:string;resourceType:string;eventType?:string;window:{from:string;toExclusive:string};schemaFingerprint:string}
export interface OrderObservation {
  id:string;sourceKey:string;orderedAt:string;recognizedAt:string|null;state:'accepted'|'cancelled'|'unknown';
  merchandise:string;sellerDiscount:string;merchandiseReversal:string;cogs:string|null;cogsEvidenceRef:string|null;variableFees:string|null;shippingIncome:string|null;earnedSubsidy:string|null;
}
export interface SettlementObservation {
  id:string;sourceKey:string;economicAt:string;dueAt:string|null;finality:'final'|'provisional';
  components:{id:string;kind:string;amount:string}[];
  receipts:{id:string;observedAt:string;amount:string;evidenceRef:string}[];
}
export interface InventoryObservation {
  id:string;sourceKey:string;poolKey:string;poolId:string;variantId:string;kind:'physical'|'advertised';
  observedAt:string;onHand:string|null;reserved:string|null;available:string|null;
}
export interface NormalizedExport {
  contract:typeof COMMERCE_CONTRACT;normalizerVersion:typeof NORMALIZER_VERSION;
  tenantId:string;provider:Provider;sourceAccountId:string;resourceType:Resource;
  currency:'VND';taxBasis:typeof TAX_BASIS;timezone:'Asia/Ho_Chi_Minh';recognitionPolicy:'fulfilled-order-cohort-v1';
  window:{from:string;toExclusive:string};observedAt:string;
  orders:OrderObservation[];settlements:SettlementObservation[];inventory:InventoryObservation[];
}
export function minor(value:unknown,nonnegative=false):string {
  if(typeof value!=='string'||! /^(?:0|-?[1-9]\d{0,29})$/.test(value)||nonnegative&&value.startsWith('-'))throw new AppError(422,'INVALID_EXACT_MONEY');
  return value;
}
export function quantity(value:unknown):string {
  if(typeof value!=='string'||! /^-?(?:0|[1-9]\d{0,11})(?:\.\d{1,6})?$/.test(value)||Number(value)===0&&value.startsWith('-'))throw new AppError(422,'INVALID_EXACT_QUANTITY');
  return value.includes('.')?value.replace(/0+$/,'').replace(/\.$/,''):value;
}
export function quantityUnits(value:string):bigint {
  const s=quantity(value),negative=s.startsWith('-'),[whole,fraction='']=(negative?s.slice(1):s).split('.');
  return (BigInt(whole!)*1_000_000n+BigInt(fraction.padEnd(6,'0')))*(negative?-1n:1n);
}
export function formatQuantity(value:bigint):string {
  const negative=value<0n,abs=negative?-value:value;
  return (negative?'-':'')+(abs/1_000_000n).toString()+((abs%1_000_000n)?'.'+(abs%1_000_000n).toString().padStart(6,'0').replace(/0+$/,''):'');
}
export function sumMinor(values:readonly string[]):string {return values.reduce((sum,v)=>sum+BigInt(minor(v)),0n).toString();}
/** Exact ratio, half away from zero. Undefined denominators are never epsilon-clamped. */
export function ratio(numerator:string,denominator:string,places=6):string|null {
  if(!Number.isInteger(places)||places<0||places>12)throw new AppError(400,'INVALID_RATIO_SCALE');
  if(!/^(?:0|-?[1-9]\d{0,35})$/.test(numerator)||!/^(?:0|-?[1-9]\d{0,35})$/.test(denominator))throw new AppError(422,'INVALID_RATIO_INPUT');
  const n=BigInt(numerator),d=BigInt(denominator);if(d===0n)return null;
  const negative=(n<0n)!==(d<0n),a=n<0n?-n:n,b=d<0n?-d:d,scale=10n**BigInt(places);
  const rounded=(a*scale*2n+b)/(2n*b),whole=rounded/scale;
  return (negative&&rounded!==0n?'-':'')+whole.toString()+(places?'.'+(rounded%scale).toString().padStart(places,'0'):'');
}
export function allocateMinor(amount:string,lines:readonly {id:string;weight:string}[]):Record<string,string> {
  const signed=BigInt(minor(amount)),total=signed<0n?-signed:signed;
  if(!lines.length||lines.length>MAX_COMMERCE_RECORDS)throw new AppError(422,'ALLOCATION_LIMIT');
  const seen=new Set<string>();const weighted=lines.map(l=>{const key=text(l.id,128);if(seen.has(key))throw new AppError(422,'DUPLICATE_ALLOCATION_ID');seen.add(key);return {id:key,weight:BigInt(minor(l.weight,true))};});
  const denominator=weighted.reduce((a,l)=>a+l.weight,0n);if(denominator===0n)throw new AppError(422,'ZERO_ALLOCATION_WEIGHT');
  const parts=weighted.map(l=>({...l,amount:total*l.weight/denominator,remainder:total*l.weight%denominator}));
  parts.sort((a,b)=>a.remainder===b.remainder?(a.id<b.id?-1:1):(a.remainder>b.remainder?-1:1));
  let left=total-parts.reduce((a,l)=>a+l.amount,0n);for(const part of parts){if(left>0n){part.amount++;left--;}}
  return Object.fromEntries(parts.sort((a,b)=>a.id<b.id?-1:1).map(p=>[p.id,(p.amount*(signed<0n?-1n:1n)).toString()]));
}
export function utcInstant(value:unknown):string {
  const s=text(value,24);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(s)||!Number.isFinite(Date.parse(s))||new Date(s).toISOString()!==s)throw new AppError(422,'INVALID_COMMERCE_INSTANT');
  return s;
}
export function businessDay(instant:string):string {return new Date(Date.parse(utcInstant(instant))+420*60_000).toISOString().slice(0,10);}
function inWindow(at:string,w:{from:string;toExclusive:string}):void {if(at<w.from||at>=w.toExclusive)throw new AppError(422,'RECORD_OUTSIDE_EXPORT_WINDOW');}
function choose<T extends string>(value:unknown,values:readonly T[],code:string):T {if(typeof value!=='string'||!values.includes(value as T))throw new AppError(422,code);return value as T;}
function nullableMoney(v:unknown){return v===null?null:minor(v);}
function nullableQuantity(v:unknown){return v===null?null:quantity(v);}
function records(value:unknown,max=MAX_COMMERCE_RECORDS):unknown[] {if(!Array.isArray(value)||value.length>max)throw new AppError(422,'COMMERCE_RECORD_LIMIT');return value;}
function unique<T extends {id:string}>(rows:T[]):T[] {const seen=new Set<string>();for(const r of rows){if(seen.has(r.id))throw new AppError(422,'DUPLICATE_SOURCE_OBJECT');seen.add(r.id);}return rows.sort((a,b)=>a.id<b.id?-1:1);}
export async function sourceKey(scope:Pick<SourceScope,'tenantId'|'provider'|'sourceAccountId'|'resourceType'>,sourceId:string){
  // Identity excludes a connection/token ID: reinstalling cannot mint a second object.
  return 'so_'+(await sha256(JSON.stringify([scope.tenantId,scope.provider,scope.sourceAccountId,scope.resourceType,text(sourceId,512)]))).slice(0,48);
}
export async function normalizeCommerceExport(raw:unknown,scope:SourceScope):Promise<NormalizedExport> {
  if(scope.eventType!=='snapshot')throw new AppError(422,'EXPLICIT_SNAPSHOT_REQUIRED');
  if(scope.schemaFingerprint!==await commerceSchemaFingerprint())throw new AppError(422,'UNSUPPORTED_COMMERCE_SCHEMA');
  const b=object(raw,schemaDescriptor.header);
  if(b.contract!==COMMERCE_CONTRACT)throw new AppError(422,'UNSUPPORTED_COMMERCE_CONTRACT');
  const provider=choose(b.provider,['nhanh','haravan','shopee','generic'],'UNKNOWN_PROVIDER');
  const resourceType=choose(b.resourceType,['orders','settlements','inventory'],'UNKNOWN_RESOURCE');
  const sourceAccountId=text(b.sourceAccountId,128);
  if(provider!==scope.provider||resourceType!==scope.resourceType||sourceAccountId!==scope.sourceAccountId)throw new AppError(422,'EMBEDDED_SOURCE_SCOPE_MISMATCH');
  if(b.currency!=='VND'||b.timezone!=='Asia/Ho_Chi_Minh')throw new AppError(422,'UNSUPPORTED_CURRENCY_OR_TIMEZONE');
  if(b.taxBasis!==TAX_BASIS)throw new AppError(422,'EXPLICIT_TAX_BASIS_REQUIRED');
  const w=object(b.window,['from','toExclusive']),window={from:utcInstant(w.from),toExclusive:utcInstant(w.toExclusive)};
  if(window.from>=window.toExclusive||window.from!==scope.window.from||window.toExclusive!==scope.window.toExclusive)throw new AppError(422,'EMBEDDED_WINDOW_MISMATCH');
  const observedAt=utcInstant(b.observedAt);if(observedAt<window.from)throw new AppError(422,'OBSERVATION_BEFORE_WINDOW');
  const out:NormalizedExport={contract:COMMERCE_CONTRACT,normalizerVersion:NORMALIZER_VERSION,tenantId:scope.tenantId,provider,sourceAccountId,resourceType,currency:'VND',taxBasis:TAX_BASIS,timezone:'Asia/Ho_Chi_Minh',recognitionPolicy:'fulfilled-order-cohort-v1',window,observedAt,orders:[],settlements:[],inventory:[]};
  const input=records(b.records);
  if(resourceType==='orders')out.orders=unique(await Promise.all(input.map(async value=>{
    const r=object(value,schemaDescriptor.orders),key=text(r.id,128),orderedAt=utcInstant(r.orderedAt);
    inWindow(orderedAt,window);if(orderedAt>observedAt)throw new AppError(422,'FUTURE_SOURCE_RECORD');
    const recognizedAt=r.recognizedAt===null?null:utcInstant(r.recognizedAt);
    if(recognizedAt!==null&&(recognizedAt<orderedAt||recognizedAt>observedAt))throw new AppError(422,'INVALID_RECOGNITION_TIME');
    const merchandise=minor(r.merchandise,true),sellerDiscount=minor(r.sellerDiscount,true),merchandiseReversal=minor(r.merchandiseReversal,true);
    if(BigInt(sellerDiscount)>BigInt(merchandise)||BigInt(merchandiseReversal)>BigInt(merchandise)-BigInt(sellerDiscount))throw new AppError(422,'INVALID_ORDER_COMPONENTS');
    const cogs=r.cogs===null?null:minor(r.cogs,true),cogsEvidenceRef=r.cogsEvidenceRef===null?null:text(r.cogsEvidenceRef,128);
    if((cogs===null)!==(cogsEvidenceRef===null))throw new AppError(422,'HISTORICAL_COGS_EVIDENCE_REQUIRED');
    const state=choose(r.state,['accepted','cancelled','unknown'],'UNKNOWN_ORDER_STATE');
    if(state==='unknown'&&recognizedAt!==null)throw new AppError(422,'UNKNOWN_STATE_CANNOT_RECOGNIZE');
    if(recognizedAt===null&&(merchandiseReversal!=='0'||cogs!==null||r.variableFees!==null))throw new AppError(422,'UNRECOGNIZED_COMPONENTS');
    return {id:key,sourceKey:await sourceKey(scope,key),orderedAt,recognizedAt,state,merchandise,sellerDiscount,merchandiseReversal,cogs,cogsEvidenceRef,variableFees:nullableMoney(r.variableFees),shippingIncome:nullableMoney(r.shippingIncome),earnedSubsidy:nullableMoney(r.earnedSubsidy)};
  })));
  if(resourceType==='settlements'){
    let entries=0;const receiptsSeen=new Set<string>();
    out.settlements=unique(await Promise.all(input.map(async value=>{
      const r=object(value,schemaDescriptor.settlements),key=text(r.id,128),economicAt=utcInstant(r.economicAt);inWindow(economicAt,window);
      if(economicAt>observedAt)throw new AppError(422,'FUTURE_SOURCE_RECORD');
      const components=unique(records(r.components).map(value=>{
        const c=object(value,schemaDescriptor.component),kind=choose(c.kind,['entitlement','fee','refund','reserve_addition','reserve_release','withholding','adjustment'],'UNCLASSIFIED_FINANCIAL_COMPONENT'),amount=minor(c.amount);
        if(['fee','refund','reserve_addition','withholding'].includes(kind)&&BigInt(amount)>0n||['entitlement','reserve_release'].includes(kind)&&BigInt(amount)<0n)throw new AppError(422,'INVALID_COMPONENT_SIGN');
        return {id:text(c.id,128),kind,amount};
      }));
      const receipts=unique(records(r.receipts).map(value=>{
        const c=object(value,schemaDescriptor.receipt),key=text(c.id,128),at=utcInstant(c.observedAt);
        if(at>observedAt)throw new AppError(422,'FUTURE_CASH_RECEIPT');
        if(receiptsSeen.has(key))throw new AppError(422,'RECEIPT_ALLOCATED_TWICE');receiptsSeen.add(key);
        return {id:key,observedAt:at,amount:minor(c.amount,true),evidenceRef:text(c.evidenceRef,128)};
      }));
      entries+=components.length+receipts.length;if(entries>200)throw new AppError(422,'FINANCIAL_ENTRY_LIMIT');
      return {id:key,sourceKey:await sourceKey(scope,key),economicAt,dueAt:r.dueAt===null?null:utcInstant(r.dueAt),finality:choose(r.finality,['final','provisional'],'UNKNOWN_FINALITY'),components,receipts};
    })));
  }
  if(resourceType==='inventory')out.inventory=unique(await Promise.all(input.map(async value=>{
    const r=object(value,schemaDescriptor.inventory),key=text(r.id,128),at=utcInstant(r.observedAt);inWindow(at,window);
    if(at>observedAt)throw new AppError(422,'FUTURE_SOURCE_RECORD');
    const poolId=text(r.poolId,128),variantId=text(r.variantId,128);
    return {id:key,sourceKey:await sourceKey(scope,key),poolKey:await sourceKey({...scope,resourceType:'physical-pool-variant'},JSON.stringify([poolId,variantId])),poolId,variantId,kind:choose(r.kind,['physical','advertised'],'UNKNOWN_STOCK_KIND'),observedAt:at,onHand:nullableQuantity(r.onHand),reserved:nullableQuantity(r.reserved),available:nullableQuantity(r.available)};
  })));
  return out;
}
/** Recognized order cohort, as known at export observation time. Not an event-date P&L. */
export function orderMetrics(rows:readonly OrderObservation[]) {
  const recognized=rows.filter(r=>r.recognizedAt!==null),count=recognized.length;
  if(!count)return {recognized_order_count:'0',net_merchandise_sales:null,cogs:null,gross_profit:null,contribution_pre_ads:null,net_aov:null,missingCogs:0,missingFees:0,missingIncome:0};
  const sales=recognized.reduce((n,r)=>n+BigInt(r.merchandise)-BigInt(r.sellerDiscount)-BigInt(r.merchandiseReversal),0n);
  const missingCogs=recognized.filter(r=>r.cogs===null).length,missingFees=recognized.filter(r=>r.variableFees===null).length;
  const missingIncome=recognized.filter(r=>r.shippingIncome===null||r.earnedSubsidy===null).length;
  const cogs=missingCogs?null:recognized.reduce((n,r)=>n+BigInt(r.cogs!),0n),gross=cogs===null?null:sales-cogs;
  const contribution=gross===null||missingFees||missingIncome?null:gross+recognized.reduce((n,r)=>n+BigInt(r.shippingIncome!)+BigInt(r.earnedSubsidy!)-BigInt(r.variableFees!),0n);
  return {recognized_order_count:String(count),net_merchandise_sales:sales.toString(),cogs:cogs?.toString()??null,gross_profit:gross?.toString()??null,contribution_pre_ads:contribution?.toString()??null,net_aov:ratio(sales.toString(),String(count)),missingCogs,missingFees,missingIncome};
}
export function settlementMetrics(rows:readonly SettlementObservation[]) {
  const final=rows.filter(r=>r.finality==='final');
  const expected=final.length?sumMinor(final.flatMap(r=>r.components.map(c=>c.amount))):null;
  const cash=rows.length?sumMinor(rows.flatMap(r=>r.receipts.map(c=>c.amount))):null;
  const matched=final.length?sumMinor(final.flatMap(r=>r.receipts.map(c=>c.amount))):null;
  return {expected_settlement:expected,observed_cash_received:cash,unreconciled_payout_amount:expected===null||matched===null?null:(BigInt(expected)-BigInt(matched)).toString(),recorded_recovery:'0',provisionalStatements:rows.length-final.length};
}
