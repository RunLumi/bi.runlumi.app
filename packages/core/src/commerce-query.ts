import {AppError,object,text,day,integer} from './contracts.ts';
import {orderMetrics,type OrderObservation} from './commerce-model.ts';

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
 {id:'physical_pool_variant_count',version:1,label:'Số pool và biến thể vật lý',unit:'count',definition:'Số gauge physical pool/variant.',availability:'scope count only'},
 {id:'net_aov',version:1,label:'Giá trị đơn ghi nhận trung bình',unit:'VND',definition:'Doanh số hàng hóa thuần chia số đơn được ghi nhận; tử và mẫu được tổng hợp trước khi chia, làm tròn nửa xa số không.',availability:'recognized order cohort'}
];
export const commerceViewerMetricIds= new Set(['net_merchandise_sales','recognized_order_count','available_units','physical_pool_variant_count']);
const metricMap=new Map(commerceMetrics.map(metric=>[metric.id,metric]));
export interface CommerceQuery {contract:typeof COMMERCE_QUERY_CONTRACT;metrics:{id:string;version:1}[];dimensions:('source')[];filters:{field:'business_date';op:'range';value:[string,string]}[];comparison?:{from:string;toExclusive:string};limit:number;consistency:'published';dataVersion:string}
export function parseCommerceQuery(value:unknown):CommerceQuery {
 const b=object(value,['contract','metrics','dimensions','filters','comparison','limit','consistency','dataVersion']);
 if(b.contract!==COMMERCE_QUERY_CONTRACT)throw new AppError(400,'INVALID_COMMERCE_QUERY_CONTRACT');
 if(!Array.isArray(b.metrics)||b.metrics.length<1||b.metrics.length>10)throw new AppError(400,'COMMERCE_QUERY_METRIC_LIMIT');
 const seen=new Set<string>();const metrics=b.metrics.map(raw=>{const item=object(raw,['id','version']),id=text(item.id,64);if(seen.has(id))throw new AppError(400,'DUPLICATE_COMMERCE_METRIC');seen.add(id);const definition=metricMap.get(id);if(!definition)throw new AppError(400,'UNKNOWN_COMMERCE_METRIC');if(item.version!==1)throw new AppError(409,'COMMERCE_METRIC_VERSION_UNSUPPORTED');return {id,version:1 as const};});
 if(!Array.isArray(b.dimensions)||b.dimensions.length>1||b.dimensions.some(d=>d!=='source'))throw new AppError(400,'COMMERCE_DIMENSION_UNAVAILABLE');
 if(!Array.isArray(b.filters)||b.filters.length>1)throw new AppError(400,'COMMERCE_FILTER_UNSUPPORTED');
 const filters=b.filters.map(raw=>{const filter=object(raw,['field','op','value']);if(filter.field!=='business_date'||filter.op!=='range'||!Array.isArray(filter.value)||filter.value.length!==2)throw new AppError(400,'COMMERCE_FILTER_UNSUPPORTED');const from=day(filter.value[0]),to=day(filter.value[1]);if(from>=to)throw new AppError(400,'COMMERCE_FILTER_RANGE');return {field:'business_date' as const,op:'range' as const,value:[from,to] as [string,string]};});
 let comparison:CommerceQuery['comparison'];if(b.comparison!==undefined){const c=object(b.comparison,['from','toExclusive']),from=day(c.from),toExclusive=day(c.toExclusive);if(from>=toExclusive)throw new AppError(400,'COMMERCE_COMPARISON_RANGE');comparison={from,toExclusive};}
 const limit=integer(b.limit);if(limit<1||limit>50)throw new AppError(400,'COMMERCE_QUERY_LIMIT');if(b.consistency!=='published')throw new AppError(400,'COMMERCE_CONSISTENCY_REQUIRED');const dataVersion=text(b.dataVersion,128);
 if(b.dimensions.length>0&&metrics.some(m=>!COHORT_METRIC_IDS.includes(m.id)))throw new AppError(400,'COMMERCE_DIMENSION_METRIC_UNAVAILABLE');
 return {contract:COMMERCE_QUERY_CONTRACT,metrics,dimensions:b.dimensions as ('source')[],filters,...(comparison?{comparison}:{}),limit,consistency:'published',dataVersion};
}
export function commerceMetricCatalog(includeSensitive=true){return commerceMetrics.filter(metric=>includeSensitive||commerceViewerMetricIds.has(metric.id));}
export function assertCommerceMetricScope(role:'viewer'|'editor'|'owner',metrics:readonly {id:string}[]){
 if(role!=='owner'&&metrics.some(metric=>!commerceViewerMetricIds.has(metric.id)))throw new AppError(403,'COMMERCE_FIELD_DENIED');
}
/** Order-cohort metrics: derivable from order rows, so a recognition-date
 * filter can recompute them. Settlement/stock metrics have their own fact
 * grains and are never recomputed under an order-date filter. */
const COHORT_METRIC_IDS=['recognized_order_count','net_merchandise_sales','cogs','gross_profit','contribution_pre_ads','net_aov'];
const REPORT_TZ_OFFSET_MS=7*60*60_000;

/** Business-day window in the report timezone (UTC+7), as a half-open UTC
 * instant interval. Recognition instants are compared against this interval,
 * never against YYYY-MM-DD text. */
export function businessDayWindow(from:string,toExclusive:string):{fromInstant:string;toInstant:string}{
 return {fromInstant:new Date(Date.parse(from+'T00:00:00.000Z')-REPORT_TZ_OFFSET_MS).toISOString(),toInstant:new Date(Date.parse(toExclusive+'T00:00:00.000Z')-REPORT_TZ_OFFSET_MS).toISOString()};
}
export const COMMERCE_QUERY_BASIS='recognized-cohort; business_date = recognition business day (Asia/Ho_Chi_Minh); half-open interval';

type MetricCell={value:string|null;unit:CommerceMetricUnit;metricVersion:1;reason?:string};
function cohortCells(values:ReturnType<typeof orderMetrics>,requested:readonly {id:string}[],filterable:boolean):Record<string,MetricCell>{
 const result:Record<string,MetricCell>={};
 for(const item of requested){
  const definition=metricMap.get(item.id)!;
  if(COHORT_METRIC_IDS.includes(item.id)){
   const raw=(values as unknown as Record<string,unknown>)[item.id];
   result[item.id]={value:raw===undefined||raw===null?null:String(raw),unit:definition.unit,metricVersion:1};
  }else{
   // A different fact grain cannot be sliced by recognition date: state that
   // instead of returning the unfiltered number or a false zero.
   result[item.id]={value:null,unit:definition.unit,metricVersion:1,reason:filterable?'METRIC_GRAIN_UNFILTERABLE':'NO_MATCHING_ROWS'};
  }
 }
 return result;
}
function reportCells(report:Record<string,unknown>,requested:readonly {id:string}[]):Record<string,MetricCell>{
 const values=report.metrics;if(!values||typeof values!=='object'||Array.isArray(values))throw new AppError(503,'COMMERCE_REPORT_INVALID');
 const row:Record<string,MetricCell>={};
 for(const item of requested){const definition=metricMap.get(item.id)!;const value=(values as Record<string,unknown>)[item.id];if(value!==null&&typeof value!=='string')throw new AppError(503,'COMMERCE_METRIC_VALUE_INVALID');row[item.id]={value:value as string|null,unit:definition.unit,metricVersion:1};}
 return row;
}
/** Coverage of a business-day filter against the published window. An
 * out-of-window range is reported as such instead of returning false zeros. */
function coverageOf(window:{from:string;toExclusive:string},range:[string,string]|undefined):'unfiltered'|'in-window'|'partial'|'out-of-window'{
 if(!range)return 'unfiltered';
 const windowFrom=window.from.slice(0,10);
 const windowLastDay=new Date(Date.parse(window.toExclusive)-1).toISOString().slice(0,10);
 const [from,to]=range;
 if(to<=windowFrom||from>windowLastDay)return 'out-of-window';
 if(from>=windowFrom&&to<=nextDay(windowLastDay))return 'in-window';
 return 'partial';
}
function nextDay(day:string):string{return new Date(Date.parse(day+'T00:00:00.000Z')+86_400_000).toISOString().slice(0,10);}

export function queryCommerceReport(report:Record<string,unknown>,query:CommerceQuery):unknown{
 const window=(report.window as {from:string;toExclusive:string}|undefined)??{from:'0000-01-01',toExclusive:'9999-12-31'};
 if(query.comparison){
  const {comparison:_,...base}=query;
  const current={...base,filters:[] as CommerceQuery['filters']};
  const prior={...base,filters:[{field:'business_date' as const,op:'range' as const,value:[query.comparison.from,query.comparison.toExclusive] as [string,string]}]};
  const comparison=queryCommerceReport(report,prior) as Record<string,unknown>;
  return {semanticBasis:COMMERCE_QUERY_BASIS,current:queryCommerceReport(report,current),comparison:{...comparison,range:{from:query.comparison.from,toExclusive:query.comparison.toExclusive}}};
 }
 if(query.dimensions.length){
  const orders=(report.orders as OrderObservation[]|undefined)??[],range=query.filters[0]?.value;
  const instants=range?businessDayWindow(range[0],range[1]):null;
  const groups=new Map<string,OrderObservation[]>();
  for(const order of orders){
   if(order.recognizedAt===null)continue;
   if(instants&&(order.recognizedAt<instants.fromInstant||order.recognizedAt>=instants.toInstant))continue;
   // A source dimension is a provider account, not an individual object identity.
   const dimension=(order as unknown as {sourceProvider?:string}).sourceProvider?`${(order as unknown as {sourceProvider:string}).sourceProvider}:${(order as unknown as {sourceAccount:string}).sourceAccount}`:'unknown-source';
   const rows=groups.get(dimension)??[];rows.push(order);groups.set(dimension,rows);
  }
  const sorted=[...groups.entries()].sort(([a],[b])=>a<b?-1:1);
  return {semanticBasis:COMMERCE_QUERY_BASIS,coverage:coverageOf(window,range),totalGroups:sorted.length,truncated:sorted.length>query.limit,groups:sorted.slice(0,query.limit).map(([dimension,rows])=>({dimension,metrics:cohortCells(orderMetrics(rows),query.metrics,true)}))};
 }
 if(query.filters.length){
  const range=query.filters[0]!.value,instants=businessDayWindow(range[0],range[1]);
  const coverage=coverageOf(window,range);
  const rows=((report.orders as OrderObservation[]|undefined)??[]).filter(order=>order.recognizedAt!==null&&order.recognizedAt>=instants.fromInstant&&order.recognizedAt<instants.toInstant);
  // An empty in-window selection is an exact zero for count and sales; cost
  // coverage over no orders is null, not zero.
  // Known cost/profit stays known under a valid filter: every requested
  // cohort metric resolves from the filtered cohort; a grain that cannot be
  // filtered says so; an out-of-window range returns no fabricated zeros.
  const values=rows.length?orderMetrics(rows):{...orderMetrics([]),recognized_order_count:'0',net_merchandise_sales:'0'};
  return {semanticBasis:COMMERCE_QUERY_BASIS,range:{from:range[0],toExclusive:range[1]},coverage,matchedOrders:rows.length,metrics:coverage==='out-of-window'?cohortCells({} as ReturnType<typeof orderMetrics>,query.metrics,false):cohortCells(values,query.metrics,rows.length>0)};
 }
 return {semanticBasis:COMMERCE_QUERY_BASIS,coverage:'unfiltered',metrics:reportCells(report,query.metrics)};
}
