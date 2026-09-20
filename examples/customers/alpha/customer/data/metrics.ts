import {manifest} from '../manifest.ts';

/** Alpha customer metric extension. Namespaced and additive: it never redefines a
 * reviewed shared metric such as sales, profit or cash. */
export interface CustomMetric {id:string;label:string;unit:'count'|'hours'|'VND';definition:string;source:{kind:'derived';from:string[];note:string}}
const NAMESPACE=manifest.extensions[0]?.namespace??'customer';
const assertNamespace=(id:string)=>{if(!id.startsWith(`${NAMESPACE}.`))throw new Error(`Custom metric must use the ${NAMESPACE}. namespace: ${id}`);return id;};
export const customMetrics:readonly CustomMetric[]=[
 {id:assertNamespace('customer.warehouse_hours_saved'),label:'Giờ tiết kiệm ở kho (Alpha)',unit:'hours',definition:'Chỉ số mở rộng của Alpha; không thay thế chỉ số dùng chung.',source:{kind:'derived',from:['operations.released_hours'],note:'Synthetic fixture. Requires review before production use.'}}
];
export function customMetricValue(id:string):{label:string;display:string}{
 const metric=customMetrics.find(m=>m.id===id);
 if(!metric)throw new Error(`Unknown custom metric: ${id}`);
 return {label:metric.label,display:'Chưa có dữ liệu'};
}
