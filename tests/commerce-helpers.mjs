import {fixture,request} from '../scripts/local-adapters.mjs';
import {COMMERCE_CONTRACT,commerceSchemaFingerprint} from '@runlumi/core/commerce-model.ts';
export function order(overrides={}) {return {id:'9007199254740993',orderedAt:'2026-09-01T17:00:00.000Z',recognizedAt:'2026-09-03T00:00:00.000Z',state:'accepted',merchandise:'1000000',sellerDiscount:'100000',merchandiseReversal:'180000',cogs:'400000',cogsEvidenceRef:'cost-at-sale-1',variableFees:'80000',shippingIncome:'0',earnedSubsidy:'0',...overrides};}
export function settlement(overrides={}) {return {id:'statement-1',economicAt:'2026-09-10T00:00:00.000Z',dueAt:null,finality:'final',components:[{id:'entitlement',kind:'entitlement',amount:'700000'},{id:'fees',kind:'fee',amount:'-70000'},{id:'reserve',kind:'reserve_addition',amount:'-100000'},{id:'release',kind:'reserve_release',amount:'20000'},{id:'withholding',kind:'withholding',amount:'-30000'}],receipts:[{id:'bank-1',observedAt:'2026-09-11T00:00:00.000Z',amount:'500000',evidenceRef:'bank-statement-1'}],...overrides};}
export function stock(overrides={}) {return {id:'stock-1',poolId:'warehouse-1',variantId:'variant-1',kind:'physical',observedAt:'2026-09-18T00:00:00.000Z',onHand:'13',reserved:'3',available:'10',...overrides};}
export function exportBody(resourceType='orders',rows,overrides={}) {return {contract:COMMERCE_CONTRACT,provider:'generic',sourceAccountId:'shop-A',resourceType,currency:'VND',taxBasis:'net-merchandise-actual-cash-v1',timezone:'Asia/Ho_Chi_Minh',window:{from:'2026-09-01T00:00:00.000Z',toExclusive:'2026-09-20T00:00:00.000Z'},observedAt:'2026-09-19T00:00:00.000Z',records:rows??[resourceType==='orders'?order():resourceType==='settlements'?settlement():stock()],...overrides};}
export async function envelope(raw=exportBody(),connectionId='orders-export',deliveryId='delivery-1') {return {eventType:'snapshot',connectionId,sourceAccountId:raw.sourceAccountId,resourceType:raw.resourceType,deliveryId,sourceObjectId:deliveryId,sourceRevision:null,sourceEventAt:null,sourceUpdatedAt:null,window:raw.window,schemaFingerprint:await commerceSchemaFingerprint(),rawJson:JSON.stringify(raw)};}
export async function commerceFixture(t){
 const f=await fixture();t.after(()=>f.close());
 const ctx={id:'alpha',role:'owner',db:f.env.TENANT_A,principal:{issuer:'local-demo',subject:'alpha-owner'},active:null,features:['bi.read','data.import'],routeEpoch:1};
 const call=async(path,body,options={})=>f.api(request('/api/tenants/alpha/'+path,{...(body===undefined?{}:{method:'POST',body}),...options}),f.env);
 const connect=(id='orders-export',resource='orders',provider='generic',account='shop-A',tenant='alpha')=>f.env[tenant==='alpha'?'TENANT_A':'TENANT_B'].db.prepare("INSERT INTO commerce_connections VALUES (?,?,?,?,?,'authorized-export','reviewed-test-export','active',1)").run(tenant,id,provider,account,resource);
 connect();
 const accept=async(raw=exportBody(),connectionId='orders-export',deliveryId='delivery-1')=>{
  const response=await call('commerce-receipts',await envelope(raw,connectionId,deliveryId));
  if(![200,202].includes(response.status))throw new Error(await response.text());return response.json();
 };
 const normalize=async(receiptId)=>call('commerce-normalizations',{receiptId});
 return {...f,ctx,call,connect,accept,normalize};
}
