import type {AppPage,PageContext} from '@runlumi/ui/app.tsx';
import {Card,CardHeader,CardTitle,CardContent} from '@runlumi/ui/components/ui/card.tsx';
import {customMetrics} from '../data/metrics.ts';

/** Beta customer page: channel margin review. Deliberately different from Alpha so the
 * upgrade test can prove customer-owned nav, pages and metrics are preserved. */
function ChannelBoard({tenant}:PageContext){
 const value=customMetrics.find(metric=>metric.id==='customer.channel_margin_note')!;
 return <><div className="page-title"><div><p className="eyebrow">BETA · KÊNH BÁN</p><h1>Bảng kênh riêng của Beta</h1></div></div>
  <Card><CardHeader><CardTitle>{value.label}</CardTitle></CardHeader><CardContent><p>{tenant?`Phạm vi: ${tenant.id}`:'Chưa chọn doanh nghiệp.'}</p><p className="muted">{value.definition} Giá trị được tải qua đăng ký server có cùng mã, không được nhúng trong trang.</p></CardContent></Card></>;
}
export const customerPages:AppPage[]=[
 {path:'/channels',label:'Kênh bán Beta',nav:({tenant})=>!!tenant,render:(ctx)=>channel(ctx)},
 {path:'/channels/notes',label:'Ghi chú kênh',nav:()=>false,render:(ctx)=>channel(ctx)}
];
function channel(ctx:PageContext){return <ChannelBoard {...ctx}/>;}
