import type {AppPage} from '@runlumi/ui/app.tsx';
import type {InstallationUser} from '@runlumi/ui/lib/api.ts';
import {Card,CardHeader,CardTitle,CardContent} from '@runlumi/ui/components/ui/card.tsx';
import {api} from '@runlumi/ui/lib/api.ts';
import {useQuery} from '@tanstack/react-query';
import {Loading,ErrorState} from '@runlumi/ui/components/states.tsx';

/** Beta channel notes: a different customer page from Alpha over the same core. */
function ChannelsPage({user}:{user:InstallationUser}){
 const metric=useQuery({queryKey:['beta-metric',user.id],queryFn:()=>api<{value:string|null;unit:string}>('/api/custom-metrics/customer.channel_margin_note','')});
 return <div className="page-title"><div><p className="eyebrow">BETA KÊNH BÁN</p><h1>Kênh bán Beta</h1><p>Beta gửi trang khác Alpha trên cùng một bản core.</p></div>
  <div style={{display:'grid',gap:12}}>
  <Card><CardHeader><CardTitle>Ghi chú biên lợi nhuận kênh</CardTitle></CardHeader><CardContent>
   {metric.isPending?<Loading/>:metric.isError?<ErrorState error={metric.error}/>:<p className="kpi-value">{metric.data.value??"Chưa xác định"}</p>}
   <p className="metric-definition">Suy ra từ operations.cases; không thay thế chỉ số dùng chung.</p>
  </CardContent></Card>
  <Card><CardHeader><CardTitle>Ghi chú kênh</CardTitle></CardHeader><CardContent><p className="metric-definition">Xem xử lý của Beta: khi có phát hiện đóng góp âm, chuyển cho chủ doanh nghiệp trực tiếp ({user.displayName||user.name}).</p></CardContent></Card>
  </div></div>;
}
export const customerPages:AppPage[]=[
 {path:'/channels',label:'Kênh bán Beta',nav:({user})=>!!user,render:({user})=>user?<ChannelsPage user={user}/>:null},
 {path:'/channels/notes',label:'Ghi chú kênh',nav:({user})=>!!user,render:({user})=>user?<ChannelsPage user={user}/>:null}
];
