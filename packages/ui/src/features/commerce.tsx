import {useState} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {api,message,type InstallationUser,type CommerceConnection,type CommerceReceipt,type CommerceNormalization,type CommerceJob,type CommercePublicationInfo} from '../lib/api.ts';
import {Card,CardHeader,CardTitle,CardContent} from '../components/ui/card.tsx';
import {Input,Textarea} from '../components/ui/input.tsx';
import {Button} from '../components/ui/button.tsx';
import {Loading,Empty,ErrorState} from '../components/states.tsx';

const stateLabel=(state:string)=>({ACCEPTED:'Đã tiếp nhận',NORMALIZING:'Đang chuẩn hóa',NORMALIZED:'Đã chuẩn hóa',PUBLISHED:'Đã công bố',QUARANTINED:'Cách ly',RETRY_PENDING:'Chờ thử lại',DEAD_LETTERED:'Thất bại',REVOKED:'Đã thu hồi'}[state]??state);

export function CommercePage({user,identity}:{user:InstallationUser;identity:string}){
 const client=useQueryClient();
 const connections=useQuery({queryKey:['connections',identity],queryFn:({signal})=>api<{connections:CommerceConnection[]}>('/api/commerce/connections',identity,{signal})});
 const receipts=useQuery({queryKey:['receipts',identity],queryFn:({signal})=>api<{receipts:CommerceReceipt[]}>('/api/commerce/receipts',identity,{signal})});
 const normalizations=useQuery({queryKey:['normalizations',identity],queryFn:({signal})=>api<{normalizations:CommerceNormalization[]}>('/api/commerce/normalizations',identity,{signal})});
 const jobs=useQuery({queryKey:['commerce-jobs',identity],queryFn:({signal})=>api<{jobs:CommerceJob[]}>('/api/commerce/jobs',identity,{signal})});
 const publication=useQuery({queryKey:['publication',identity],queryFn:({signal})=>api<CommercePublicationInfo>('/api/commerce/publications',identity,{signal})});
 const [connectionId,setConnectionId]=useState('');const [resourceType,setResourceType]=useState('orders');const [account,setAccount]=useState('');const [approval,setApproval]=useState('');
 const [envelope,setEnvelope]=useState('');const [note,setNote]=useState('');
 const [staged,setStaged]=useState<{normalizationIds:string[];preview:CommercePublicationInfo|null;previewHash:string}|null>(null);
 const parsed=envelope.trim()?(()=>{try{return {ok:true as const,value:JSON.parse(envelope)};}catch{return {ok:false as const};}})():null;
 const invalidate=()=>{for(const key of ['connections','receipts','normalizations','commerce-jobs','publication'])client.invalidateQueries({queryKey:[key,identity]});};
 const connect=useMutation({mutationFn:()=>api('/api/commerce/connections',identity,{method:'POST',body:{id:connectionId,provider:'generic',sourceAccountId:account,resourceType,approvalRef:approval}}),
  onSuccess:()=>{setNote('Đã cấp quyền nguồn (chỉ tiếp nhận bản xuất đã ủy quyền).');setConnectionId('');setAccount('');setApproval('');invalidate();},onError:error=>setNote(message(error))});
 const changeConnection=useMutation({mutationFn:(input:{id:string;state:string;revision:number})=>api(`/api/commerce/connections/${input.id}`,identity,{method:'PUT',body:{state:input.state,reason:`${input.state} by owner`,expectedRevision:input.revision}}),
  onSuccess:()=>{setNote('Đã cập nhật trạng thái nguồn.');invalidate();},onError:error=>setNote(message(error))});
 const accept=useMutation({mutationFn:()=>api('/api/commerce/receipts',identity,{method:'POST',body:(parsed as {ok:true;value:unknown}).value}),
  onSuccess:()=>{setNote('Đã tiếp nhận bản xuất và lưu bằng chứng bất biến.');setEnvelope('');invalidate();},onError:error=>setNote(message(error))});
 const normalize=useMutation({mutationFn:(receiptId:string)=>api('/api/commerce/normalizations',identity,{method:'POST',body:{receiptId}}),
  onSuccess:(value:unknown)=>{const result=value as {state:string;reasonCode:string|null};setNote(result.state==='NORMALIZED'?'Chuẩn hóa thành công.':'Bị cách ly: '+String(result.reasonCode));invalidate();},onError:error=>setNote(message(error))});
 const enqueue=useMutation({mutationFn:(receiptId:string)=>api('/api/commerce/jobs',identity,{method:'POST',body:{receiptId}}),
  onSuccess:()=>{setNote('Đã xếp hàng chuẩn hóa.');invalidate();},onError:error=>setNote(message(error))});
 const runJob=useMutation({mutationFn:(jobId:string)=>api(`/api/commerce/jobs/${jobId}/run`,identity,{method:'POST',body:{}}),
  onSuccess:()=>{setNote('Đã chạy tác vụ.');invalidate();},onError:error=>setNote(message(error))});
 const preview=useMutation({mutationFn:(normalizationIds:string[])=>api('/api/commerce/publications/preview',identity,{method:'POST',body:{normalizationIds,mappingId:null,controls:[],expectedRevision:publication.data?.revision??0,expectedPublicationId:publication.data?.activePublicationId??null}}),
  onSuccess:(value:unknown)=>{const result=value as {previewHash:string;report:unknown};setStaged({normalizationIds:staged!.normalizationIds,preview:{activePublicationId:null,revision:publication.data?.revision??0,publication:{id:'',mappingId:null,contentHash:'',publishedAt:'',report:result.report as never}},previewHash:result.previewHash});setNote('Đã duyệt bản xem trước. Kiểm tra rồi công bố.');},onError:error=>setNote(message(error))});
 const publish=useMutation({mutationFn:(input:{normalizationIds:string[];previewHash:string})=>api('/api/commerce/publications',identity,{method:'POST',body:{normalizationIds:input.normalizationIds,mappingId:null,controls:[],expectedRevision:publication.data?.revision??0,expectedPublicationId:publication.data?.activePublicationId??null,previewHash:input.previewHash,reason:'UI publication'}}),
  onSuccess:()=>{setNote('Đã công bố. Mọi số liệu commerce đọc từ bản này.');setStaged(null);invalidate();},onError:error=>setNote(message(error))});
 const busy=connections.isPending||receipts.isPending||normalizations.isPending||publication.isPending||jobs.isPending;
 const hasError=connections.isError||receipts.isError||normalizations.isError||publication.isError||jobs.isError;
 if(busy)return <Loading/>;
 if(hasError)return <ErrorState error={connections.error??receipts.error??normalizations.error??publication.error??jobs.error} retry={()=>{invalidate();window.location.reload();}}/>;
 const active=publication.data?.publication;
 const selectForPublication=(normalizationId:string,checked:boolean)=>{
  const current=new Set(staged?.normalizationIds??[]);
  if(checked)current.add(normalizationId);else current.delete(normalizationId);
  setStaged({normalizationIds:[...current].sort(),preview:null,previewHash:''});
 };
 return <div className="page-title"><div><p className="eyebrow">COMMERCE</p><h1>Nguồn commerce và công bố</h1><p>Chỉ tiếp nhận bản xuất đã ủy quyền. Số công bố là bằng chứng bất biến; không có kết nối trực tiếp nào tới nhà cung cấp.</p></div>
 <div style={{display:'grid',gap:12}}>
  {publication.data&&publication.data.revision===0&&<div className="notice"><strong>Chưa có bản công bố.</strong><p>Chuẩn hóa ít nhất một bản rồi công bố để các báo cáo có dữ liệu thống nhất.</p></div>}
  <Card><CardHeader><CardTitle>Kết nối nguồn (authorized export)</CardTitle></CardHeader><CardContent>
   <div className="table-scroll"><table><thead><tr><th>Mã</th><th>Tài khoản</th><th>Loại</th><th>Trạng thái</th><th>Phiên bản</th><th>Thao tác</th></tr></thead><tbody>
   {connections.data.connections.map(item=><tr key={item.id}><td><code>{item.id}</code></td><td>{item.sourceAccountId}</td><td>{item.resourceType}</td><td>{stateLabel(item.state)}</td><td>v{item.revision}</td>
    <td>{item.state!=='revoked'&&<span style={{display:'flex',gap:6}}>{item.state==='active'&&<Button size="sm" variant="outline" onClick={()=>changeConnection.mutate({id:item.id,state:'paused',revision:item.revision})}>Tạm dừng</Button>}{item.state==='paused'&&<Button size="sm" variant="outline" onClick={()=>changeConnection.mutate({id:item.id,state:'active',revision:item.revision})}>Kích hoạt</Button>}<Button size="sm" variant="outline" onClick={()=>changeConnection.mutate({id:item.id,state:'revoked',revision:item.revision})}>Thu hồi</Button></span>}</td></tr>)}
   </tbody></table></div>
   <form style={{display:'grid',gap:10,marginTop:12}} onSubmit={event=>{event.preventDefault();connect.mutate();}}>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:10}}>
     <label>Mã kết nối<Input required pattern="[a-z0-9][a-z0-9_-]*" value={connectionId} onChange={e=>setConnectionId(e.target.value)} placeholder="shopee-orders"/></label>
     <label>Tài khoản nguồn<Input required value={account} onChange={e=>setAccount(e.target.value)} placeholder="shop-A"/></label>
     <label>Loại dữ liệu<select value={resourceType} onChange={e=>setResourceType(e.target.value)}><option value="orders">Đơn hàng</option><option value="settlements">Đối soát</option><option value="inventory">Tồn kho</option></select></label>
     <label>Mã phê duyệt nội bộ<Input required value={approval} onChange={e=>setApproval(e.target.value)} placeholder="bien-ban-phe-duyet-01"/></label></div>
    <Button type="submit" disabled={connect.isPending}>Cấp quyền nguồn</Button>
   </form></CardContent></Card>
  <Card><CardHeader><CardTitle>Tiếp nhận bản xuất (snapshot envelope)</CardTitle></CardHeader><CardContent>
   <form style={{display:'grid',gap:10}} onSubmit={event=>{event.preventDefault();accept.mutate();}}>
   <label>Nội dung envelope JSON (tối đa 48 KB, 100 bản ghi)<Textarea required rows={5} value={envelope} onChange={e=>setEnvelope(e.target.value)} placeholder='{"eventType":"snapshot","connectionId":"orders-export",...}'/></label>
   {parsed&&!parsed.ok&&<p role="alert" className="quality-note">JSON chưa hợp lệ.</p>}
   <Button type="submit" disabled={accept.isPending||!parsed?.ok}>Tiếp nhận bằng chứng</Button>
   </form></CardContent></Card>
  <Card><CardHeader><CardTitle>Bằng chứng đã tiếp nhận</CardTitle></CardHeader><CardContent><div className="table-scroll"><table><thead><tr><th>Receipt</th><th>Kết nối</th><th>Trạng thái</th><th>Chuẩn hóa</th><th>Thao tác</th></tr></thead><tbody>
   {receipts.data.receipts.length===0&&<tr><td colSpan={5}><Empty>Chưa có bằng chứng nào.</Empty></td></tr>}
   {receipts.data.receipts.map(item=>{const job=jobs.data.jobs.find(j=>j.receiptId===item.receiptId);const build=normalizations.data.normalizations.find(n=>n.receiptId===item.receiptId);
    return <tr key={item.receiptId}><td><code>{item.receiptId.slice(0,14)}…</code></td><td>{item.connectionId}</td><td>{stateLabel(item.state)}</td>
    <td>{build?stateLabel(build.state)+(build.reasonCode?` (${build.reasonCode})`:''):'—'}</td>
    <td>{user.role==='owner'&&<span style={{display:'flex',gap:6}}>{!job&&<Button size="sm" variant="outline" onClick={()=>enqueue.mutate(item.receiptId)}>Xếp hàng</Button>}{(!build||build.state!=='NORMALIZED')&&job&&job.state!=='SUCCEEDED'&&<Button size="sm" variant="outline" onClick={()=>runJob.mutate(job.jobId)}>Chạy</Button>}{!build&&<Button size="sm" variant="outline" onClick={()=>normalize.mutate(item.receiptId)}>Chuẩn hóa ngay</Button>}</span>}</td></tr>;})}
  </tbody></table></div></CardContent></Card>
  <Card><CardHeader><CardTitle>Công bố báo cáo</CardTitle></CardHeader><CardContent>
   {normalizations.data.normalizations.filter(n=>n.state==='NORMALIZED').length===0?<Empty>Chưa có bản chuẩn hóa nào đủ điều kiện.</Empty>:<><div className="table-scroll"><table><thead><tr><th>Chọn</th><th>Chuẩn hóa</th><th>Số dòng</th><th>Thời điểm</th></tr></thead><tbody>
   {normalizations.data.normalizations.filter(n=>n.state==='NORMALIZED').map(item=><tr key={item.normalizationId}><td><input type="checkbox" aria-label={`Chọn ${item.normalizationId}`} checked={(staged?.normalizationIds??[]).includes(item.normalizationId)} onChange={e=>selectForPublication(item.normalizationId,e.target.checked)}/></td><td><code>{item.normalizationId.slice(0,14)}…</code></td><td>{item.recordCount}</td><td>{item.createdAt}</td></tr>)}
   </tbody></table></div>
   <div style={{display:'flex',gap:8,marginTop:10,alignItems:'center'}}>
    <Button size="sm" variant="outline" disabled={!staged?.normalizationIds.length} onClick={()=>preview.mutate(staged!.normalizationIds)}>Duyệt xem trước</Button>
    <Button size="sm" disabled={!staged?.previewHash} onClick={()=>publish.mutate({normalizationIds:staged!.normalizationIds,previewHash:staged!.previewHash})}>Công bố</Button>
    {active&&<span style={{display:'flex',gap:6}}><a className="tag" href={`/api/commerce/publications/${active.id}/export?format=csv`}>Tải CSV</a><a className="tag" href={`/api/commerce/publications/${active.id}/export?format=json`}>Tải JSON</a></span>}
   </div></>}
   {staged?.preview?.publication&&<details open className="config-editor"><summary>Bản xem trước đã duyệt</summary><pre className="metric-definition" style={{whiteSpace:'pre-wrap'}}>{JSON.stringify(staged.preview.publication.report.metrics,null,2)}</pre><p className="metric-definition">Cảnh báo: {staged.preview.publication.report.warnings.join(', ')}</p></details>}
   {active&&<p className="quality-note" role="status">Bản công bố hiện hành: <code>{active.id.slice(0,14)}…</code> · v{publication.data?.revision} · {active.publishedAt}</p>}
  </CardContent></Card>
  <span role="status">{note}</span>
 </div></div>;
}
