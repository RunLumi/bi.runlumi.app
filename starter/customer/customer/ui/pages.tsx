import type {AppPage,PageContext} from '@runlumi/ui/app.tsx';
import {Card,CardHeader,CardTitle,CardContent} from '@runlumi/ui/components/ui/card.tsx';
import {useQuery} from '@tanstack/react-query';
import {api} from '@runlumi/ui/lib/api.ts';

/** Example customer page. Real React, reviewed in the customer repository.
 * It consumes the public UI package; it does not edit core source. */
function CustomerOverviewPage({tenant,identity}:PageContext){
 const metric=useQuery({enabled:!!tenant,queryKey:['customer-metric',identity,tenant?.id],queryFn:()=>api<{id:string;value:string|null;unit:string;scope:{tenantId:string}}>('/api/tenants/'+tenant!.id+'/custom-metrics/customer.example_hours_saved',identity)});
 return <Card><CardHeader><CardTitle>Trang riêng của doanh nghiệp</CardTitle></CardHeader>
  <CardContent><p>{tenant?`Phạm vi: ${tenant.id}`:'Chưa chọn doanh nghiệp.'}</p><p className="muted">Giờ tiết kiệm (riêng): {metric.isPending?'Đang tải…':metric.isError?'Không khả dụng':metric.data?.value??'Chưa xác định'} {metric.data?.unit??''}</p></CardContent></Card>;
}

export const customerPages:AppPage[]=[
 {path:'/customer-overview',label:'Tổng quan riêng',nav:({tenant})=>!!tenant,render:(ctx)=>tenantPage(ctx)}
];
function tenantPage(ctx:PageContext){return <CustomerOverviewPage {...ctx}/>;}
