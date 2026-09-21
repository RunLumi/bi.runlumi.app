import type {AppPage,PageContext} from '@runlumi/ui/app.tsx';
import {Card,CardHeader,CardTitle,CardContent} from '@runlumi/ui/components/ui/card.tsx';
import {useQuery} from '@tanstack/react-query';
import {api} from '@runlumi/ui/lib/api.ts';

/** Beta customer page: channel margin review. Deliberately different from Alpha so the
 * upgrade test can prove customer-owned nav, pages and metrics are preserved. Values
 * are loaded through the server-authorized custom metric registration, never embedded. */
function ChannelBoard({tenant,identity}:PageContext){
 const metric=useQuery({enabled:!!tenant,queryKey:['customer-metric',identity,tenant?.id],queryFn:()=>api<{id:string;value:string|null;unit:string;scope:{tenantId:string}}>('/api/tenants/'+tenant!.id+'/custom-metrics/customer.channel_margin_note',identity)});
 return <><div className="page-title"><div><p className="eyebrow">BETA · KÊNH BÁN</p><h1>Bảng kênh riêng của Beta</h1></div></div>
  <Card><CardHeader><CardTitle>Ghi chú biên lợi nhuận kênh</CardTitle></CardHeader><CardContent><p>{tenant?`Phạm vi: ${tenant.id}`:'Chưa chọn doanh nghiệp.'}</p><p className="muted">Lượt xử lý (riêng): {metric.isPending?'Đang tải…':metric.isError?'Không khả dụng':metric.data?.value??'Chưa xác định'} {metric.data?.unit??''}</p></CardContent></Card></>;
}
export const customerPages:AppPage[]=[
 {path:'/channels',label:'Kênh bán Beta',nav:({tenant})=>!!tenant,render:(ctx)=>channel(ctx)},
 {path:'/channels/notes',label:'Ghi chú kênh',nav:()=>false,render:(ctx)=>channel(ctx)}
];
function channel(ctx:PageContext){return <ChannelBoard {...ctx}/>;}