import {useState} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {api,message,type InstallationUser} from '../lib/api.ts';
import {Card,CardHeader,CardTitle,CardContent} from '../components/ui/card.tsx';
import {Input,Textarea} from '../components/ui/input.tsx';
import {Button} from '../components/ui/button.tsx';
import {Loading,Empty,ErrorState} from '../components/states.tsx';

interface Source {id:string;name:string;state:'active'|'disabled'}
interface ImportRow {id:string;source_id:string;content_hash:string;observed_through:string;ingested_at:string;record_count:number}

export function SourcesPage({user,identity}:{user:InstallationUser;identity:string}){
 const client=useQueryClient();
 const sources=useQuery({queryKey:['sources',identity],queryFn:({signal})=>api<{sources:Source[]}>('/api/sources',identity,{signal})});
 const imports=useQuery({queryKey:['imports',identity],queryFn:({signal})=>api<{imports:ImportRow[]}>('/api/imports',identity,{signal})});
 const [sourceId,setSourceId]=useState('');const [name,setName]=useState('');
 const [importSource,setImportSource]=useState('');const [observedThrough,setObservedThrough]=useState('');const [rows,setRows]=useState('');const [key,setKey]=useState('');const [note,setNote]=useState('');
 const owner=user.role==='owner';
 const register=useMutation({mutationFn:()=>api('/api/sources',identity,{method:'POST',body:{id:sourceId,name}}),
  onSuccess:()=>{setNote('Đã đăng ký nguồn.');setSourceId('');setName('');client.invalidateQueries({queryKey:['sources',identity]});},onError:error=>setNote(message(error))});
 const toggle=useMutation({mutationFn:(input:{id:string;state:string})=>api(`/api/sources/${input.id}`,identity,{method:'PUT',body:{state:input.state}}),
  onSuccess:()=>client.invalidateQueries({queryKey:['sources',identity]}),onError:error=>setNote(message(error))});
 const parsed=rows.trim()?(()=>{try{return {ok:true as const,value:JSON.parse(rows)};}catch{return {ok:false as const};}})():null;
 const importSnapshot=useMutation({mutationFn:()=>api('/api/imports',identity,{method:'POST',headers:{'idempotency-key':key},body:{sourceId:importSource,observedThrough,records:(parsed as {ok:true;value:unknown}).value}}),
  onSuccess:()=>{setNote('Đã nhập snapshot có chứng từ.');setRows('');setKey('');client.invalidateQueries({queryKey:['imports',identity]});client.invalidateQueries({queryKey:['sources',identity]});},onError:error=>setNote(message(error))});
 if(sources.isPending||imports.isPending)return <Loading/>;
 if(sources.isError||imports.isError)return <ErrorState error={sources.error??imports.error} retry={()=>{sources.refetch();imports.refetch();}}/>;
 return <div className="page-title"><div><p className="eyebrow">NGUỒN DỮ LIỆU</p><h1>Nguồn và nhập liệu</h1><p>Mỗi snapshot được lưu bất biến kèm mã băm và mốc quan sát. Dữ liệu thiếu không bao giờ được tự điền số 0.</p></div>
 <div style={{display:'grid',gap:12}}>
 <Card><CardHeader><CardTitle>Nguồn đã đăng ký</CardTitle></CardHeader><CardContent><div className="table-scroll"><table><thead><tr><th>Mã</th><th>Tên</th><th>Trạng thái</th>{owner&&<th>Thao tác</th>}</tr></thead><tbody>
 {sources.data.sources.map(source=><tr key={source.id}><td><code>{source.id}</code></td><td>{source.name}</td><td>{source.state==='active'?'Hoạt động':'Tạm dừng'}</td>
  {owner&&<td><Button size="sm" variant="outline" onClick={()=>toggle.mutate({id:source.id,state:source.state==='active'?'disabled':'active'})}>{source.state==='active'?'Tạm dừng':'Kích hoạt'}</Button></td>}</tr>)}
 </tbody></table></div></CardContent></Card>
 {owner&&<Card><CardHeader><CardTitle>Nhập snapshot vận hành</CardTitle></CardHeader><CardContent><form style={{display:'grid',gap:10}} onSubmit={event=>{event.preventDefault();importSnapshot.mutate();}}>
  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
   <label>Mã nguồn đã đăng ký<Input required pattern="[a-z0-9][a-z0-9_-]*" value={importSource} onChange={e=>setImportSource(e.target.value)} placeholder="ops"/></label>
   <label>Quan sát đến ngày<Input required type="date" value={observedThrough} onChange={e=>setObservedThrough(e.target.value)}/></label></div>
  <label>Mã chống trùng (idempotency key)<Input required value={key} onChange={e=>setKey(e.target.value)} placeholder="ops-2026-W38"/></label>
  <label>Dữ liệu JSON (mảng bản ghi, 1–20 dòng)<Textarea required rows={6} value={rows} onChange={e=>setRows(e.target.value)} placeholder='[{"recordId":"r1","day":"2026-09-20","workflow":"support","cases":3,"baselineMinutes":60,"humanMinutes":15,"runtimeCostVnd":1000,"supportCostVnd":500,"cashSavingsVnd":0,"cashEvidenceRef":null}]'/></label>
  {parsed&&!parsed.ok&&<p role="alert" className="quality-note">JSON chưa hợp lệ.</p>}
  <Button type="submit" disabled={importSnapshot.isPending||!parsed?.ok}>Nhập snapshot</Button>
  <span role="status">{note}</span></form></CardContent></Card>}
 <Card><CardHeader><CardTitle>Lịch sử nhập</CardTitle></CardHeader><CardContent>{imports.data.imports.length? <div className="table-scroll"><table><thead><tr><th>Snapshot</th><th>Nguồn</th><th>Quan sát đến</th><th>Số dòng</th><th>Mã băm</th></tr></thead><tbody>
  {imports.data.imports.map(item=><tr key={item.id}><td><code>{item.id.slice(0,12)}…</code></td><td>{item.source_id}</td><td>{item.observed_through}</td><td>{item.record_count}</td><td><code>{item.content_hash.slice(0,16)}…</code></td></tr>)}
 </tbody></table></div>:<Empty>Chưa có snapshot nào được nhập.</Empty>}</CardContent></Card>
 {owner&&<Card><CardHeader><CardTitle>Đăng ký nguồn mới</CardTitle></CardHeader><CardContent><form style={{display:'grid',gap:10}} onSubmit={event=>{event.preventDefault();register.mutate();}}>
  <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:10}}>
   <label>Mã nguồn mới<Input required pattern="[a-z0-9][a-z0-9_-]*" value={sourceId} onChange={e=>setSourceId(e.target.value)}/></label>
   <label>Tên gọi<Input required value={name} onChange={e=>setName(e.target.value)}/></label></div>
  <Button type="submit" disabled={register.isPending}>Đăng ký nguồn</Button></form></CardContent></Card>}
 </div></div>;
}
