import type {AppPage,PageContext} from '@runlumi/ui/app.tsx';
import {Card,CardHeader,CardTitle,CardContent} from '@runlumi/ui/components/ui/card.tsx';
import {customMetrics} from '../data/metrics.ts';

/** Alpha customer page: warehouse-level stock review. Reviewed customer React composed
 * from the public UI package; it does not edit core source. */
function WarehouseBoard({tenant}:PageContext){
 const value=customMetrics.find(metric=>metric.id==='customer.warehouse_hours_saved')!;
 return <><div className="page-title"><div><p className="eyebrow">ALPHA · KHO VẬN</p><h1>Bảng kho riêng của Alpha</h1></div></div>
  <Card><CardHeader><CardTitle>{value.label}</CardTitle></CardHeader><CardContent><p>{tenant?`Phạm vi: ${tenant.id}`:'Chưa chọn doanh nghiệp.'}</p><p className="muted">{value.definition} Giá trị được tải qua đăng ký server có cùng mã, không được nhúng trong trang.</p></CardContent></Card></>;
}
export const customerPages:AppPage[]=[
 {path:'/warehouse',label:'Kho vận Alpha',nav:({tenant})=>!!tenant,render:(ctx)=>warehouse(ctx)}
];
function warehouse(ctx:PageContext){return <WarehouseBoard {...ctx}/>;}
