import type {AppPage,PageContext} from '@runlumi/ui/app.tsx';
import {Card,CardHeader,CardTitle,CardContent} from '@runlumi/ui/components/ui/card.tsx';
import {useQuery} from '@tanstack/react-query';
import {api} from '@runlumi/ui/lib/api.ts';

/** Alpha customer page: warehouse-level stock review. Reviewed customer React composed
 * from the public UI package; it does not edit core source. The value is loaded by the
 * server-authorized custom metric registration under the same id, never embedded. */
function WarehouseBoard({tenant,identity}:PageContext){
 const metric=useQuery({enabled:!!tenant,queryKey:['customer-metric',identity,tenant?.id],queryFn:()=>api<{id:string;value:string|null;unit:string;scope:{tenantId:string}}>('/api/tenants/'+tenant!.id+'/custom-metrics/customer.warehouse_hours_saved',identity)});
 return <><div className="page-title"><div><p className="eyebrow">ALPHA · KHO VẬN</p><h1>Bảng kho riêng của Alpha</h1></div></div>
  <Card><CardHeader><CardTitle>Giờ tiết kiệm ở kho</CardTitle></CardHeader><CardContent><p>{tenant?`Phạm vi: ${tenant.id}`:'Chưa chọn doanh nghiệp.'}</p><p className="muted">Giờ tiết kiệm (riêng): {metric.isPending?'Đang tải…':metric.isError?'Không khả dụng':metric.data?.value??'Chưa xác định'} {metric.data?.unit??''}</p></CardContent></Card></>;
}
export const customerPages:AppPage[]=[
 {path:'/warehouse',label:'Kho vận Alpha',nav:({tenant})=>!!tenant,render:(ctx)=>warehouse(ctx)}
];
function warehouse(ctx:PageContext){return <WarehouseBoard {...ctx}/>;}