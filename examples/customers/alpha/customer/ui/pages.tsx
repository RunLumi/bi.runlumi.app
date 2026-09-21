import type {AppPage} from '@runlumi/ui/app.tsx';
import type {InstallationUser} from '@runlumi/ui/lib/api.ts';
import {Card,CardHeader,CardTitle,CardContent} from '@runlumi/ui/components/ui/card.tsx';
import {api,message} from '@runlumi/ui/lib/api.ts';
import {useQuery} from '@tanstack/react-query';
import {Loading,ErrorState} from '@runlumi/ui/components/states.tsx';

/** Alpha warehouse briefing: a customer page composed from the packaged core UI.
 * It fetches the customer-registered metric over the session-scoped API instead
 * of embedding any value in code. */
function WarehousePage({user}:{user:InstallationUser}){
 const metric=useQuery({queryKey:['alpha-metric',user.id],queryFn:()=>api<{value:string|null;unit:string}>('/api/custom-metrics/customer.warehouse_hours_saved','')});
 return <div className="page-title"><div><p className="eyebrow">ALPHA KHO VẬN</p><h1>Kho vận Alpha</h1><p>Trang riêng của Alpha, dựng từ gói UI của core mà không sửa nội bộ core.</p></div>
  <Card><CardHeader><CardTitle>Giờ tiết kiệm ở kho (Alpha)</CardTitle></CardHeader><CardContent>
   {metric.isPending?<Loading/>:metric.isError?<ErrorState error={metric.error}/>:<p className="kpi-value">{metric.data.value??"Chưa xác định"}</p>}
   <p className="metric-definition">Chỉ số mở rộng của Alpha; không thay thế chỉ số dùng chung. Thiếu dữ liệu thì hiển thị chưa xác định, không tự điền 0.</p>
  </CardContent></Card></div>;
}
export const customerPages:AppPage[]=[
 {path:'/warehouse',label:'Kho vận Alpha',nav:({user})=>!!user,render:({user})=>user?<WarehousePage user={user}/>:null}
];
