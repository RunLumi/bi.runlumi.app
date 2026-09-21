/** Customer metric extensions. Metrics are namespaced and additive: a customer
 * extension may add a new metric or explicitly version a meaning, but it can never
 * silently redefine a reviewed shared metric such as sales, profit or cash.
 * Deterministic finance rules live in core and are not overridable here. */
import {manifest} from '../manifest.ts';

export interface CustomMetric {
  /** Stable namespaced ID. Must start with the customer extension namespace. */
  id: string;
  label: string;
  unit: 'count' | 'hours' | 'VND';
  definition: string;
  /** Reviewed source expression is compiled by core infrastructure, not evaluated here. */
  source: { kind: 'derived'; from: string[]; note: string };
}

const NAMESPACE=manifest.extensions[0]?.namespace??'customer';
const assertNamespace=(id:string)=>{if(!id.startsWith(`${NAMESPACE}.`))throw new Error(`Custom metric must use the ${NAMESPACE}. namespace: ${id}`);return id;};

export const customMetrics:readonly CustomMetric[]=[
 {id:assertNamespace('customer.example_hours_saved'),label:'Giờ tiết kiệm (riêng)',unit:'hours',definition:'Chỉ số mở rộng do doanh nghiệp định nghĩa, không thay thế chỉ số dùng chung.',source:{kind:'derived',from:['operations.released_hours'],note:'Synthetic deterministic extension. Requires review before production use.'}}
];

export function customMetricValue(id:string):{label:string;display:string}{
 const metric=customMetrics.find(m=>m.id===id);
 if(!metric)throw new Error(`Unknown custom metric: ${id}`);
 return {label:metric.label,display:'Chờ tải từ máy chủ được cấp quyền'};
}
