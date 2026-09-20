import {useState} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {api,dashboardData,message,type SavedDashboard,type Tenant,type Metric} from '../lib/api.ts';
import {Card,CardHeader,CardTitle,CardContent} from '../components/ui/card.tsx';
import {Input,Textarea} from '../components/ui/input.tsx';import {Button} from '../components/ui/button.tsx';
import {Loading,Empty,ErrorState} from '../components/states.tsx';import {RefreshGlyph} from '../components/glyphs.tsx';
function initialWindow(demo:boolean):readonly [string,string]{
 if(demo)return ['2026-09-01','2026-10-01'];
 const parts=new Intl.DateTimeFormat('en',{timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'numeric'}).formatToParts(new Date());
 const year=Number(parts.find(p=>p.type==='year')!.value),month=Number(parts.find(p=>p.type==='month')!.value);
 return [`${year}-${String(month).padStart(2,'0')}-01`,`${month===12?year+1:year}-${String(month===12?1:month+1).padStart(2,'0')}-01`];
}
export function DashboardPage({tenant,identity,demo}:{tenant:Tenant;identity:string;demo:boolean}){
 const list=useQuery({queryKey:['dashboards',identity,tenant.id],queryFn:({signal})=>api<{dashboards:SavedDashboard[]}>(`/api/tenants/${tenant.id}/dashboards`,identity,{signal})});
 const [selected,setSelected]=useState('');const [from,setFrom]=useState<string>(()=>initialWindow(demo)[0]);const [to,setTo]=useState<string>(()=>initialWindow(demo)[1]);
 if(list.isPending)return <Loading/>;if(list.isError)return <ErrorState error={list.error} retry={()=>list.refetch()}/>;
 const dashboard=list.data.dashboards.find(d=>d.id===selected)??list.data.dashboards[0];
 if(!dashboard)return <Empty>Chưa có dashboard được công bố.</Empty>;
 return <><div className="page-title"><div><p className="eyebrow">OPERATIONS INTELLIGENCE</p><h1>{dashboard.definition.title}</h1><p>Hiểu hiệu quả vận hành. Biết bằng chứng phía sau mỗi con số.</p></div><span className="tag">{dashboard.management==='git'?'Git-managed':'UI-managed'} · v{dashboard.revision}</span></div>
 <div className="toolbar"><label>Dashboard<select value={dashboard.id} onChange={e=>setSelected(e.target.value)}>{list.data.dashboards.map(d=><option key={d.id} value={d.id}>{d.definition.title}</option>)}</select></label><label>Từ ngày<Input type="date" value={from} onChange={e=>setFrom(e.target.value)}/></label><label>Đến trước ngày<Input type="date" value={to} onChange={e=>setTo(e.target.value)}/></label></div>
 <DashboardCanvas key={`${tenant.id}:${dashboard.id}:${dashboard.revision}:${dashboard.releaseId??''}`} tenant={tenant} identity={identity} dashboard={dashboard} from={from} to={to}/>
 <div className="notice"><strong>Giờ công được giải phóng không phải tiền mặt tiết kiệm.</strong><p>Lợi ích tiền mặt chỉ ghi nhận khi có chi phí thực tế đã giảm và mã bằng chứng. Dữ liệu thiếu không được hiển thị thành 0.</p></div>
 <Editor key={`${tenant.id}:${dashboard.id}:${dashboard.revision}`} tenant={tenant} identity={identity} dashboard={dashboard}/></>;
}
function DashboardCanvas({tenant,identity,dashboard,from,to}:{tenant:Tenant;identity:string;dashboard:SavedDashboard;from:string;to:string}){
 const client=useQueryClient();
 const query=useQuery({queryKey:['results',identity,tenant.id,dashboard.id,dashboard.revision,dashboard.configurationRelease,dashboard.configurationRevision,from,to],queryFn:({signal})=>dashboardData(tenant.id,identity,dashboard,from,to,signal)});
 const catalog=useQuery({queryKey:['metrics',identity,tenant.id,dashboard.configurationRelease,dashboard.configurationRevision],queryFn:({signal})=>api<{metrics:Metric[]}>(`/api/tenants/${tenant.id}/metrics`,identity,{signal})});
 if(query.isPending||catalog.isPending)return <Loading/>;if(query.isError||catalog.isError)return <ErrorState error={query.error??catalog.error} retry={()=>{client.invalidateQueries({queryKey:['dashboards',identity,tenant.id]});query.refetch();catalog.refetch();}}/>;
 const lookup=new Map(catalog.data.metrics.map(m=>[m.id,m]));
 const fmt=(v:unknown,metricId:string)=>typeof v==='number'?new Intl.NumberFormat('vi-VN',{maximumFractionDigits:lookup.get(metricId)?.unit==='hours'?1:0}).format(v):String(v??'Chưa xác định');
 return <><div className="result-actions"><span className="tag">Snapshot thống nhất · {query.data[0]?.meta.provenance.length??0} nguồn</span><Button size="sm" variant="ghost" onClick={()=>query.refetch()}><RefreshGlyph/>Tải lại dữ liệu</Button></div><div className="quality-note" role="status">{query.data[0]?.meta.qualityState==='MISSING_SOURCE'?'Thiếu snapshot của nguồn đã đăng ký. Số liệu hiện tại chỉ là một phần.':query.data[0]?.meta.qualityState==='NO_PUBLISHED_DATA'?'Chưa có dữ liệu được công bố.':query.data[0]?.meta.qualityState==='BEHIND_REQUESTED_PERIOD'?'Mốc nguồn chưa bao phủ hết kỳ đã chọn. Không coi số liệu này là tổng của cả kỳ.':'Snapshot đã được công bố; độ đầy đủ của nguồn chưa được xác nhận.'}</div><div className="dashboard-grid">{dashboard.definition.widgets.map((w,i)=>{
  const r=query.data[i]!;const metricId=w.metrics[0]!;const m=lookup.get(metricId);const noData=r.meta.noPublishedData||!r.data.length||r.data.every(x=>Number(x.matched_rows)===0);
  return <Card key={w.id} className={w.kind==='kpi'?'kpi-card':'wide-card'}><CardHeader><p className="eyebrow">{m?.unit==='VND'?'ĐỒNG VIỆT NAM':m?.unit==='hours'?'GIỜ CÔNG':'KHỐI LƯỢNG'}</p><CardTitle>{w.title}</CardTitle></CardHeader><CardContent>{noData?<p className="unavailable">Chưa có dữ liệu</p>:w.kind==='kpi'?<p className="kpi-value">{fmt(r.data[0]?.[metricId],metricId)}</p>:w.kind==='bar'?<div className="bars">{r.data.map((row,j)=>{
 if(row[metricId]===null || row[metricId]===undefined)return <p key={j}>{row.dimension}: Chưa xác định</p>;
 const value=Number(row[metricId]);const max=Math.max(1,...r.data.map(x=>Math.abs(Number(x[metricId]??0))));return <div className="bar-row" key={j}><div><span>{row.dimension}</span><strong>{fmt(value,metricId)}</strong></div><meter className="bar-meter" min={0} max={max} value={Math.abs(value)} aria-label={`${row.dimension}: ${fmt(value,metricId)}`} data-negative={value<0}/></div>;
 })}</div>:<div className="table-scroll"><table><caption className="sr-only">{w.title}</caption><thead><tr><th>Nhóm</th>{w.metrics.map(id=><th key={id}>{lookup.get(id)?.label??id}</th>)}</tr></thead><tbody>{r.data.map((row,j)=><tr key={j}><td>{row.dimension??'Tổng'}</td>{w.metrics.map(id=><td key={id} className="numeric">{fmt(row[id],id)}</td>)}</tr>)}</tbody></table></div>}
 <p className="metric-definition">{m?.definition}</p><details><summary>Nguồn và giới hạn</summary><ul className="evidence-list">{r.meta.provenance.map(source=><li key={source.id}>Nguồn ghi nhận đến {source.observed_through}<br/><code>{source.content_hash.slice(0,16)}…</code></li>)}</ul><small>Mốc dữ liệu không phải bằng chứng nguồn đã đầy đủ.</small></details></CardContent></Card>;
 })}</div></>;
}
function Editor({tenant,identity,dashboard}:{tenant:Tenant;identity:string;dashboard:SavedDashboard}){
 const client=useQueryClient();const [value,setValue]=useState(JSON.stringify(dashboard.definition,null,2));const [note,setNote]=useState('');
 const mutation=useMutation({mutationFn:async(copy:boolean)=>{let definition:unknown;try{definition=JSON.parse(value);}catch{throw new Error('INVALID_JSON');}return api(`/api/tenants/${tenant.id}/dashboards${copy?'':`/${dashboard.id}`}`,identity,{method:copy?'POST':'PUT',body:copy?{id:`dashboard-${crypto.randomUUID().slice(0,8)}`,definition}:definition,...(!copy?{revision:dashboard.revision}:{})});},onSuccess:()=>{setNote('Đã lưu cấu hình được kiểm tra.');client.invalidateQueries({queryKey:['dashboards',identity,tenant.id]});}});
 if(tenant.role==='viewer'||!tenant.features.includes('dashboard.edit'))return null;
 return <details className="config-editor"><summary>Tùy chỉnh dashboard</summary><p>{dashboard.management==='git'?'Nguồn chính thức nằm trong Git. Tạo bản sao để thử; thay đổi bản chính qua pull request.':'Cấu hình khai báo, không nhận SQL, HTML hoặc script. Lưu có kiểm tra revision.'}</p><label className="sr-only" htmlFor="dashboard-json">Cấu hình dashboard JSON</label><Textarea id="dashboard-json" rows={12} value={value} onChange={e=>setValue(e.target.value)}/><div className="editor-actions"><Button disabled={mutation.isPending||dashboard.management==='git'} onClick={()=>mutation.mutate(false)}>Lưu thay đổi</Button><Button variant="outline" disabled={mutation.isPending} onClick={()=>mutation.mutate(true)}>Tạo bản sao</Button><span role="status">{mutation.isError?message(mutation.error):note}</span></div></details>;
}
