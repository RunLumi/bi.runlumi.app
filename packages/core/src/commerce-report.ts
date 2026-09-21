import {AppError,id,integer,object,text} from './contracts.ts';
import {SEMANTIC_VERSION,orderMetrics,settlementMetrics,minor,quantityUnits,formatQuantity,type NormalizedExport,type InventoryObservation} from './commerce-model.ts';
export interface IdentityLink {sourceKey:string;canonicalId:string;priority:number}
export interface IdentityMapping {evidenceRef:string;entries:IdentityLink[]}
export interface ReportInput {normalizationId:string;receiptId:string;contentHash:string;rawContentHash:string;data:NormalizedExport}
export interface SourceControl {normalizationId:string;recordCount:number;netSales:string|null;expectedSettlement:string|null;evidenceRef:string}
export function parseIdentityMapping(value:unknown):IdentityMapping {
  const b=object(value,['evidenceRef','entries']);
  if(!Array.isArray(b.entries)||b.entries.length>200)throw new AppError(422,'MAPPING_LIMIT');
  const seen=new Set<string>();
  const entries=b.entries.map(v=>{const r=object(v,['sourceKey','canonicalId','priority']),sourceKey=id(r.sourceKey);if(!/^so_[a-f0-9]{48}$/.test(sourceKey)||seen.has(sourceKey))throw new AppError(422,'INVALID_SOURCE_LINK');seen.add(sourceKey);return {sourceKey,canonicalId:id(r.canonicalId),priority:integer(r.priority,1000)};});
  entries.sort((a,b)=>a.sourceKey<b.sourceKey?-1:1);
  return {evidenceRef:text(b.evidenceRef,128),entries};
}
export function parseSourceControls(value:unknown):SourceControl[] {
  if(!Array.isArray(value)||value.length>10)throw new AppError(422,'CONTROL_LIMIT');
  const seen=new Set<string>();return value.map(v=>{
    const b=object(v,['normalizationId','recordCount','netSales','expectedSettlement','evidenceRef']),normalizationId=id(b.normalizationId);
    if(seen.has(normalizationId))throw new AppError(422,'DUPLICATE_SOURCE_CONTROL');seen.add(normalizationId);
    return {normalizationId,recordCount:integer(b.recordCount),netSales:b.netSales===null?null:minor(b.netSales),expectedSettlement:b.expectedSettlement===null?null:minor(b.expectedSettlement),evidenceRef:text(b.evidenceRef,128)};
  }).sort((a,b)=>a.normalizationId<b.normalizationId?-1:1);
}
const resourceKey=(d:NormalizedExport)=>JSON.stringify([d.provider,d.sourceAccountId,d.resourceType]);
export function assembleCommerceReport(inputs:ReportInput[],mapping:IdentityMapping|null,controls:SourceControl[]) {
  if(!inputs.length||inputs.length>10)throw new AppError(422,'PUBLICATION_INPUT_LIMIT');
  const first=inputs[0]!.data,keys=new Set<string>(),linkMap=new Map(mapping?.entries.map(e=>[e.sourceKey,e])??[]);
  for(const input of inputs){
    const d=input.data;if(d.window.from!==first.window.from||d.window.toExclusive!==first.window.toExclusive)throw new AppError(422,'PUBLICATION_WINDOW_MISMATCH');
    const k=resourceKey(d);if(keys.has(k))throw new AppError(422,'OVERLAPPING_SOURCE_SNAPSHOTS');keys.add(k);
  }
  const sources=inputs.map(i=>({normalizationId:i.normalizationId,receiptId:i.receiptId,contentHash:i.contentHash,rawContentHash:i.rawContentHash,provider:i.data.provider,sourceAccountId:i.data.sourceAccountId,resourceType:i.data.resourceType,observedAt:i.data.observedAt,recordCount:i.data.orders.length+i.data.settlements.length+i.data.inventory.length}));
  const checks=controls.map(c=>{
    const input=inputs.find(i=>i.normalizationId===c.normalizationId);if(!input)throw new AppError(422,'CONTROL_OUTSIDE_PUBLICATION');
    const d=input.data,count=d.orders.length+d.settlements.length+d.inventory.length;
    const sales=d.resourceType==='orders'?orderMetrics(d.orders).net_merchandise_sales:null;
    const payout=d.resourceType==='settlements'?settlementMetrics(d.settlements).expected_settlement:null;
    // A zero-row independent control may validate a declared zero without altering display semantics.
    const comparableSales=count===0&&d.resourceType==='orders'?'0':sales;
    const comparablePayout=count===0&&d.resourceType==='settlements'?'0':payout;
    return {...c,actualRecordCount:count,actualNetSales:comparableSales,actualExpectedSettlement:comparablePayout,passed:count===c.recordCount&&(c.netSales===null||c.netSales===comparableSales)&&(c.expectedSettlement===null||c.expectedSettlement===comparablePayout),independence:'owner-declared-not-verified' as const};
  });
  if(checks.some(c=>!c.passed))throw new AppError(422,'INDEPENDENT_CONTROL_MISMATCH');
  const exclusions:{resource:string;canonicalId:string;chosenSourceKey:string;excludedSourceKey:string;reason:string}[]=[];
  function canonical<T extends {sourceKey:string}>(rows:Array<{row:T;provider:string;account:string}>,resource:string,key:(r:T)=>string,economic:(r:T)=>unknown):Array<T&{canonicalId:string;sourceProvider:string;sourceAccount:string}> {
    const count=inputs.filter(i=>i.data.resourceType===resource).length;
    const groups=new Map<string,{row:T;priority:number;sourceKey:string;provider:string;account:string}[]>();
    for(const {row,provider,account} of rows){
      const source=key(row),link=linkMap.get(source);
      // Multiple sources require reviewed links for EVERY object, even those believed unrelated.
      if(count>1&&!link)throw new AppError(422,'CROSS_SOURCE_IDENTITY_REVIEW_REQUIRED');
      const canonicalId=link?.canonicalId??source,group=groups.get(canonicalId)??[];group.push({row,priority:link?.priority??0,sourceKey:source,provider,account});groups.set(canonicalId,group);
    }
    return [...groups.entries()].sort(([a],[b])=>a<b?-1:1).map(([canonicalId,group])=>{
      group.sort((a,b)=>a.priority-b.priority||(a.sourceKey<b.sourceKey?-1:1));const chosen=group[0]!;
      for(const other of group.slice(1)){
        const equal=JSON.stringify(economic(chosen.row))===JSON.stringify(economic(other.row));
        if(other.priority===chosen.priority&&!equal)throw new AppError(422,'UNRESOLVED_SOURCE_AUTHORITY');
        exclusions.push({resource,canonicalId,chosenSourceKey:chosen.row.sourceKey,excludedSourceKey:other.row.sourceKey,reason:equal?'MIRRORED_OBSERVATION':'REVIEWED_SOURCE_PRIORITY'});
      }
      return {...chosen.row,canonicalId,sourceProvider:chosen.provider,sourceAccount:chosen.account};
    });
  }
  const orders=canonical(inputs.flatMap(i=>i.data.orders.map(row=>({row,provider:i.data.provider,account:i.data.sourceAccountId}))),'orders',r=>r.sourceKey,r=>({orderedAt:r.orderedAt,recognizedAt:r.recognizedAt,state:r.state,merchandise:r.merchandise,sellerDiscount:r.sellerDiscount,merchandiseReversal:r.merchandiseReversal,cogs:r.cogs,variableFees:r.variableFees,shippingIncome:r.shippingIncome,earnedSubsidy:r.earnedSubsidy}));
  const settlements=canonical(inputs.flatMap(i=>i.data.settlements.map(row=>({row,provider:i.data.provider,account:i.data.sourceAccountId}))),'settlements',r=>r.sourceKey,r=>({economicAt:r.economicAt,finality:r.finality,components:r.components.map(c=>[c.kind,c.amount]),receipts:r.receipts.map(c=>[c.id,c.amount,c.evidenceRef])}));
  const bankReceipts=new Set<string>();for(const s of settlements)for(const r of s.receipts){const k=JSON.stringify([r.evidenceRef,r.id]);if(bankReceipts.has(k))throw new AppError(422,'CASH_RECEIPT_REUSED');bankReceipts.add(k);}
  // First select a gauge at the latest observed instant within each source pool. Never sum time.
  const latest=new Map<string,InventoryObservation>();let advertised=0;
  for(const r of inputs.flatMap(i=>i.data.inventory)){
    if(r.kind==='advertised'){advertised++;continue;}
    const previous=latest.get(r.poolKey);
    if(previous&&previous.observedAt===r.observedAt&&JSON.stringify([previous.onHand,previous.reserved,previous.available])!==JSON.stringify([r.onHand,r.reserved,r.available]))throw new AppError(422,'CONFLICTING_STOCK_GAUGE');
    if(!previous||r.observedAt>previous.observedAt||r.observedAt===previous.observedAt&&r.sourceKey<previous.sourceKey)latest.set(r.poolKey,r);
  }
  const inventory=canonical([...latest.values()].map(row=>{const input=inputs.find(i=>(i.data.inventory as unknown[]).includes(row))!;return {row,provider:input.data.provider,account:input.data.sourceAccountId};}),'inventory',r=>r.poolKey,r=>({observedAt:r.observedAt,onHand:r.onHand,reserved:r.reserved,available:r.available}));
  const money=orderMetrics(orders),cash=settlementMetrics(settlements);
  const missingStock=inventory.filter(r=>r.available===null).length;
  const stockTotal=inventory.length&&!missingStock?formatQuantity(inventory.reduce((sum,r)=>sum+quantityUnits(r.available!),0n)):null;
  const warnings:string[]=['SOURCE_COMPLETENESS_UNVERIFIED','MERCHANT_CERTIFICATION_REQUIRED'];
  if(checks.length<inputs.length)warnings.push('MISSING_INDEPENDENT_CONTROLS');
  if(money.missingCogs)warnings.push('MISSING_HISTORICAL_COGS');if(money.missingFees)warnings.push('MISSING_VARIABLE_FEES');
  if(money.missingIncome)warnings.push('MISSING_EARNED_COMPONENTS');
  if(missingStock)warnings.push('MISSING_AVAILABLE_STOCK');if(inventory.some(r=>r.available!==null&&quantityUnits(r.available)<0n))warnings.push('NEGATIVE_STOCK');
  if(advertised)warnings.push('ADVERTISED_STOCK_EXCLUDED');if(exclusions.some(e=>e.reason==='REVIEWED_SOURCE_PRIORITY'))warnings.push('SOURCE_AUTHORITY_DIFFERENCE');
  return {contract:'lumi.commerce.report.v1' as const,semanticVersion:SEMANTIC_VERSION,currency:'VND' as const,taxBasis:first.taxBasis,timezone:first.timezone,recognitionPolicy:first.recognitionPolicy,window:first.window,sources,checks,exclusions,warnings,qualityState:'PROVISIONAL' as const,sourceCompletenessCertified:false,merchantVerified:false,liveProviderVerified:false,
    metrics:{...money,...cash,available_units:stockTotal,physical_pool_variant_count:String(inventory.length)},orders,settlements,inventory,
    limitations:['Order-cohort view as known at source observation time, not event-date statutory accounts.','Cash allocations and reconciliation independence are owner-declared.','Available units are a scope count across possibly different products, not inventory value.','Stock aging, unconstrained demand and automated replenishment are unavailable.']};
}
export type CommerceReport=ReturnType<typeof assembleCommerceReport>;
