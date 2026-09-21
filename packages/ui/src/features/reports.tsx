import {useState} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {api,message,type InstallationUser,type CommerceInsight,type CommercePublicationInfo} from '../lib/api.ts';
import {Card,CardHeader,CardTitle,CardContent} from '../components/ui/card.tsx';
import {Input} from '../components/ui/input.tsx';
import {Button} from '../components/ui/button.tsx';
import {Loading,Empty,ErrorState} from '../components/states.tsx';

const fmt=(value:string|null):string=>value===null?'Chưa xác định':(/^-?\d+$/.test(value)?new Intl.NumberFormat('vi-VN').format(BigInt(value)):value);

/** Saved, publication-backed insight reports with reproducible runs. */
export function ReportsPage({user,identity}:{user:InstallationUser;identity:string}){
 const client=useQueryClient();
 const insights=useQuery({queryKey:['insights',identity],queryFn:({signal})=>api<{insights:CommerceInsight[]}>('/api/commerce/insights',identity,{signal})});
 const publication=useQuery({queryKey:['publication',identity],queryFn:({signal})=>api<CommercePublicationInfo>('/api/commerce/publications',identity,{signal})});
 const [title,setTitle]=useState('');const [note,setNote]=useState('');const [promoted,setPromoted]=useState('');
 const owner=user.role==='owner';
 const invalidate=()=>{client.invalidateQueries({queryKey:['insights',identity]});};
 const create=useMutation({mutationFn:()=>{
   const publicationId=publication.data?.publication?.id??publication.data?.activePublicationId;
   const window=publication.data?.publication?.report.window;
   const metricIds=['net_merchandise_sales','recognized_order_count'];
   const body={id:'report-'+Date.now().toString(36),title,definition:{metricIds,from:window?.from.slice(0,10)??'2026-01-01',toExclusive:window?.toExclusive.slice(0,10)??'2026-01-31',dataVersion:publicationId,blocks:metricIds.map(metricId=>({id:metricId,kind:'metric' as const,metricId}))}};
   return api('/api/commerce/insights',identity,{method:'POST',body});
  },onSuccess:()=>{setNote('Đã lưu báo cáo gắn với bản công bố hiện hành.');setTitle('');invalidate();},onError:error=>setNote(message(error))});
 const refresh=useMutation({mutationFn:(insight:CommerceInsight)=>api(`/api/commerce/insights/${insight.id}/refresh`,identity,{method:'POST',body:{expectedRevision:insight.revision}}),
  onSuccess:()=>{setNote('Đã chạy lại trên bản công bố hiện hành.');invalidate();},onError:error=>setNote(message(error))});
 const promote=useMutation({mutationFn:(insight:CommerceInsight)=>api(`/api/commerce/insights/${insight.id}/promote`,identity,{method:'POST',body:{}}),
  onSuccess:(value:unknown)=>{const proposal=value as {source:string;path:string};setPromoted(proposal.path);setNote(`Đề xuất đã tạo: ${proposal.path}. Sao chép vào thư viện khách hàng và gửi duyệt.`);},onError:error=>setNote(message(error))});
 if(insights.isPending||publication.isPending)return <Loading/>;
 if(insights.isError||publication.isError)return <ErrorState error={insights.error??publication.error} retry={()=>{insights.refetch();publication.refetch();}}/>;
 return <div className="page-title"><div><p className="eyebrow">BÁO CÁO ĐÃ LƯU</p><h1>Báo cáo và bằng chứng tái lập</h1><p>Mỗi báo cáo chạy trên một bản công bố cụ thể; kết quả chạy được lưu lại kèm mã băm để đối chiếu.</p></div>
 <div style={{display:'grid',gap:12}}>
  {owner&&<Card><CardHeader><CardTitle>Lưu báo cáo mới từ bản công bố hiện hành</CardTitle></CardHeader><CardContent>
   <form style={{display:'flex',gap:10,alignItems:'end'}} onSubmit={event=>{event.preventDefault();create.mutate();}}>
    <label style={{flex:1}}>Tên báo cáo<Input required value={title} onChange={e=>setTitle(e.target.value)} placeholder="Tuần 38 – doanh số và đơn"/></label>
    <Button type="submit" disabled={create.isPending||!publication.data?.publication}>Lưu báo cáo</Button>
   </form></CardContent></Card>}
  {!insights.data.insights.length?<Empty>Chưa có báo cáo nào được lưu.</Empty>:insights.data.insights.map(insight=><Card key={insight.id}><CardHeader><CardTitle>{insight.title}</CardTitle></CardHeader><CardContent>
   <p className="metric-definition">Kỳ {insight.definition.from} → {insight.definition.toExclusive} · bản công bố <code>{insight.definition.dataVersion.slice(0,14)}…</code> · v{insight.revision}</p>
   {insight.runs[0]&&<div className="table-scroll"><table><thead><tr><th>Chỉ số</th><th>Giá trị</th><th>Đơn vị</th></tr></thead><tbody>
    {Object.entries(insight.runs[0].result).map(([metricId,cell])=><tr key={metricId}><td>{metricId}</td><td className="numeric">{fmt(cell.value)}</td><td>{cell.unit}</td></tr>)}
   </tbody></table></div>}
   {owner&&<div style={{display:'flex',gap:8,marginTop:10}}>
    <Button size="sm" variant="outline" disabled={refresh.isPending} onClick={()=>refresh.mutate(insight)}>Chạy lại</Button>
    <Button size="sm" variant="outline" disabled={promote.isPending} onClick={()=>promote.mutate(insight)}>Đề xuất báo cáo TSX</Button>
   </div>}
  </CardContent></Card>)}
  <span role="status">{note}{promoted&&<>{' '}<a className="tag" href="#" onClick={event=>event.preventDefault()}>{promoted}</a></>}</span>
 </div></div>;
}
