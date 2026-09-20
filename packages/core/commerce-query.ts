import {AppError,object,text,day,integer} from './contracts.ts';

export const COMMERCE_QUERY_CONTRACT='lumi.query.v1';
export const COMMERCE_SEMANTIC_RELEASE='commerce-cohort-v1.0.0';
export type CommerceMetricUnit='count'|'VND'|'units';
export interface CommerceMetricDefinition {id:string;version:1;label:string;unit:CommerceMetricUnit;definition:string;availability:string}
export const commerceMetrics:readonly CommerceMetricDefinition[]=[
 {id:'net_merchandise_sales',version:1,label:'Doanh thu hàng hóa thuần',unit:'VND',definition:'Giá trị hàng hóa được ghi nhận trừ giảm giá người bán và đảo giảm trừ.',availability:'recognized order cohort; source completeness remains unverified'},
 {id:'recognized_order_count',version:1,label:'Số đơn được ghi nhận',unit:'count',definition:'Số đơn canonical distinct có dòng được ghi nhận.',availability:'recognized order cohort; source completeness remains unverified'},
 {id:'cogs',version:1,label:'Giá vốn hàng bán',unit:'VND',definition:'Giá vốn lịch sử của các đơn được ghi nhận.',availability:'null when cost coverage is incomplete'},
 {id:'gross_profit',version:1,label:'Lợi nhuận gộp',unit:'VND',definition:'Doanh thu hàng hóa thuần trừ giá vốn hàng bán.',availability:'null when cost coverage is incomplete'},
 {id:'contribution_pre_ads',version:1,label:'Đóng góp trước quảng cáo',unit:'VND',definition:'Lợi nhuận gộp cộng khoản thu được hưởng trừ phí biến đổi.',availability:'null when cost, fee or earned-component coverage is incomplete'},
 {id:'expected_settlement',version:1,label:'Khoản phải đối soát',unit:'VND',definition:'Các thành phần statement đã chốt.',availability:'null when no final statement is present'},
 {id:'observed_cash_received',version:1,label:'Tiền đã quan sát nhận',unit:'VND',definition:'Các khoản tiền nhận được gắn với chứng từ.',availability:'not bank reconciliation'},
 {id:'unreconciled_payout_amount',version:1,label:'Chênh lệch đối soát',unit:'VND',definition:'Khoản chênh giữa statement cuối và các khoản nhận được.',availability:'not recovered cash'},
 {id:'available_units',version:1,label:'Số lượng khả dụng',unit:'units',definition:'Gauge khả dụng mới nhất của physical stock pools.',availability:'null when any selected pool lacks available quantity'},
 {id:'physical_pool_variant_count',version:1,label:'Số pool và biến thể vật lý',unit:'count',definition:'Số gauge physical pool/variant.',availability:'scope count only'}
];
const metricMap=new Map(commerceMetrics.map(metric=>[metric.id,metric]));
export interface CommerceQuery {contract:typeof COMMERCE_QUERY_CONTRACT;metrics:{id:string;version:1}[];dimensions:[];filters:{field:'business_date';op:'range';value:[string,string]}[];limit:1;consistency:'published';dataVersion:string}
export function parseCommerceQuery(value:unknown):CommerceQuery {
 const b=object(value,['contract','metrics','dimensions','filters','limit','consistency','dataVersion']);
 if(b.contract!==COMMERCE_QUERY_CONTRACT)throw new AppError(400,'INVALID_COMMERCE_QUERY_CONTRACT');
 if(!Array.isArray(b.metrics)||b.metrics.length<1||b.metrics.length>10)throw new AppError(400,'COMMERCE_QUERY_METRIC_LIMIT');
 const seen=new Set<string>();const metrics=b.metrics.map(raw=>{const item=object(raw,['id','version']),id=text(item.id,64);if(seen.has(id))throw new AppError(400,'DUPLICATE_COMMERCE_METRIC');seen.add(id);const definition=metricMap.get(id);if(!definition)throw new AppError(400,'UNKNOWN_COMMERCE_METRIC');if(item.version!==1)throw new AppError(409,'COMMERCE_METRIC_VERSION_UNSUPPORTED');return {id,version:1 as const};});
 if(!Array.isArray(b.dimensions)||b.dimensions.length!==0)throw new AppError(400,'COMMERCE_DIMENSION_UNAVAILABLE');
 if(!Array.isArray(b.filters)||b.filters.length>1)throw new AppError(400,'COMMERCE_FILTER_UNSUPPORTED');
 const filters=b.filters.map(raw=>{const filter=object(raw,['field','op','value']);if(filter.field!=='business_date'||filter.op!=='range'||!Array.isArray(filter.value)||filter.value.length!==2)throw new AppError(400,'COMMERCE_FILTER_UNSUPPORTED');const from=day(filter.value[0]),to=day(filter.value[1]);if(from>=to)throw new AppError(400,'COMMERCE_FILTER_RANGE');return {field:'business_date' as const,op:'range' as const,value:[from,to] as [string,string]};});
 if(integer(b.limit)!==1)throw new AppError(400,'COMMERCE_QUERY_LIMIT');if(b.consistency!=='published')throw new AppError(400,'COMMERCE_CONSISTENCY_REQUIRED');const dataVersion=text(b.dataVersion,128);
 return {contract:COMMERCE_QUERY_CONTRACT,metrics,dimensions:[],filters,limit:1,consistency:'published',dataVersion};
}
export function commerceMetricCatalog(){return commerceMetrics;}
export function queryCommerceReport(report:Record<string,unknown>,query:CommerceQuery){
 const values=report.metrics;if(!values||typeof values!=='object'||Array.isArray(values))throw new AppError(503,'COMMERCE_REPORT_INVALID');const row:Record<string,{value:string|null;unit:CommerceMetricUnit;metricVersion:1}>={};
 for(const requested of query.metrics){const definition=metricMap.get(requested.id)!;const value=(values as Record<string,unknown>)[requested.id];if(value!==null&&typeof value!=='string')throw new AppError(503,'COMMERCE_METRIC_VALUE_INVALID');row[requested.id]={value:value as string|null,unit:definition.unit,metricVersion:1};}return row;
}
