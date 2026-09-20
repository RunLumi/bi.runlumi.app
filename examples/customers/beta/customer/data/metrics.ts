import {manifest} from '../manifest.ts';

/** Beta customer metric extension. Namespaced and additive. */
export interface CustomMetric {id:string;label:string;unit:'count'|'hours'|'VND';definition:string;source:{kind:'derived';from:string[];note:string}}
const NAMESPACE=manifest.extensions[0]?.namespace??'customer';
const assertNamespace=(id:string)=>{if(!id.startsWith(`${NAMESPACE}.`))throw new Error(`Custom metric must use the ${NAMESPACE}. namespace: ${id}`);return id;};
export const customMetrics:readonly CustomMetric[]=[
 {id:assertNamespace('customer.channel_margin_note'),label:'Ghi chú biên lợi nhuận kênh (Beta)',unit:'count',definition:'Chỉ số mở rộng của Beta; không thay thế chỉ số dùng chung.',source:{kind:'derived',from:['commerce.orders'],note:'Synthetic fixture. Requires review before production use.'}}
];
export function customMetricValue(id:string):{label:string;display:string}{
 const metric=customMetrics.find(m=>m.id===id);
 if(!metric)throw new Error(`Unknown custom metric: ${id}`);
 return {label:metric.label,display:'Chưa có dữ liệu'};
}
