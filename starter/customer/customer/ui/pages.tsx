import type {AppPage,PageContext} from '@runlumi/ui/app.tsx';
import {Card,CardHeader,CardTitle,CardContent} from '@runlumi/ui/components/ui/card.tsx';
import {customMetricValue} from '../data/metrics.ts';

/** Example customer page. Real React, reviewed in the customer repository.
 * It consumes the public UI package; it does not edit core source. */
function CustomerOverviewPage({tenant}:PageContext){
 const value=customMetricValue('custom.example_hours_saved');
 return <Card><CardHeader><CardTitle>Trang riêng của doanh nghiệp</CardTitle></CardHeader>
  <CardContent><p>{tenant?`Phạm vi: ${tenant.id}`:'Chưa chọn doanh nghiệp.'}</p><p className="muted">{value.label}: {value.display}</p></CardContent></Card>;
}

export const customerPages:AppPage[]=[
 {path:'/customer-overview',label:'Tổng quan riêng',nav:({tenant})=>!!tenant,render:(ctx)=>tenantPage(ctx)}
];
function tenantPage(ctx:PageContext){return <CustomerOverviewPage {...ctx}/>;}
