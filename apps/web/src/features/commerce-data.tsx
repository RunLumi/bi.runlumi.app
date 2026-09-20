import {useState,type FormEvent} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {api,ApiError,type Tenant} from '@/lib/api';
import {commercePermitted,localInstant,type CommerceConnection,type CommerceBuild,type CommerceReceipt,type Candidate,type Preview} from '@/lib/commerce';
import {commerceSchemaFingerprint} from '../../../../packages/core/commerce-model.ts';
import {Card,CardHeader,CardTitle,CardContent} from '@/components/ui/card';import {Button} from '@/components/ui/button';
import {Loading,ErrorState,Empty} from '@/components/states';import {ReportMetrics,ReportEvidence} from './commerce-report';
function json(value:string):unknown {try{return JSON.parse(value);}catch{throw new ApiError('INVALID_JSON',400);}}
export function CommerceDataPage(props:{tenant:Tenant;identity:string}){
 if(!commercePermitted(props.tenant))return <Empty>Chỉ chủ doanh nghiệp được cấp quyền nhập dữ liệu mới quản lý nguồn thương mại.</Empty>;
 return <AuthorizedDataPage {...props}/>;
}
function AuthorizedDataPage({tenant,identity}:{tenant:Tenant;identity:string}){
 const base=`/api/tenants/${tenant.id}`,client=useQueryClient();
 const connections=useQuery({queryKey:['commerce-connections',identity,tenant.id],queryFn:({signal})=>api<{connections:CommerceConnection[]}>(base+'/commerce-connections',identity,{signal})});
 const receipts=useQuery({queryKey:['commerce-receipts',identity,tenant.id],queryFn:({signal})=>api<{receipts:CommerceReceipt[]}>(base+'/commerce-receipts',identity,{signal})});
 const builds=useQuery({queryKey:['commerce-builds',identity,tenant.id],queryFn:({signal})=>api<{normalizations:CommerceBuild[]}>(base+'/commerce-normalizations',identity,{signal})});
 const head=useQuery({queryKey:['commerce-head',identity,tenant.id],queryFn:({signal})=>api<{activePublicationId:string|null;revision:number}>(base+'/commerce-publications/status',identity,{signal})});
 const [sourceId,setSourceId]=useState(''),[provider,setProvider]=useState('generic'),[account,setAccount]=useState(''),[resource,setResource]=useState('orders'),[approval,setApproval]=useState('');
 const [connectionId,setConnectionId]=useState(''),[file,setFile]=useState<File|null>(null),[deliveryId,setDeliveryId]=useState('');
 const [selected,setSelected]=useState<string[]>([]),[controls,setControls]=useState('[]'),[mappingJson,setMappingJson]=useState('{"evidenceRef":"","entries":[]}'),[mappingId,setMappingId]=useState('');
 const [preview,setPreview]=useState<(Preview&{candidate:Candidate})|null>(null),[reason,setReason]=useState(''),[notice,setNotice]=useState('');
 const refresh=async()=>{await Promise.all(['commerce-connections','commerce-receipts','commerce-builds','commerce-head','commerce-report','commerce-decisions'].map(key=>client.invalidateQueries({queryKey:[key,identity,tenant.id]})));};
 const mutation=useMutation({mutationFn:async(action:'source'|'upload'|'mapping'|'preview'|'publish'|{normalize:string}|{connection:CommerceConnection;state:string;reason:string})=>{
  setNotice('');
  if(action==='source'){
   await api(base+'/commerce-connections',identity,{method:'POST',body:{id:sourceId,provider,sourceAccountId:account,resourceType:resource,approvalRef:approval}});setConnectionId(sourceId);setNotice('Đã ghi nhận quyền dùng bản xuất. Chưa xác minh kết nối API trực tiếp.');
  }else if(action==='upload'){
   if(!file||file.size>48_000)throw new ApiError('RAW_EXPORT_LIMIT',422);
   const rawJson=await file.text(),raw=json(rawJson) as Record<string,unknown>;
   if(!raw||Array.isArray(raw)||typeof raw!=='object')throw new ApiError('INVALID_JSON',400);
   const value=await api<{receiptId:string}>(base+'/commerce-receipts',identity,{method:'POST',body:{eventType:'snapshot',connectionId,sourceAccountId:raw.sourceAccountId,resourceType:raw.resourceType,deliveryId,sourceObjectId:deliveryId,sourceRevision:null,sourceEventAt:null,sourceUpdatedAt:null,window:raw.window,schemaFingerprint:await commerceSchemaFingerprint(),rawJson}});
   setNotice('Đã giữ bằng chứng gốc: '+value.receiptId+'. Cần chuẩn hóa và duyệt trước khi công bố.');
  }else if(action==='mapping'){
   const value=await api<{mappingId:string}>(base+'/commerce-mappings',identity,{method:'POST',body:json(mappingJson)});setMappingId(value.mappingId);setPreview(null);setNotice('Đã lưu bản liên kết danh tính do chủ nguồn duyệt.');
  }else if(action==='preview'){
   setPreview(null);const independent=json(controls);if(!Array.isArray(independent))throw new ApiError('CONTROL_LIMIT',422);
   const status=await head.refetch();if(!status.data)throw status.error;
   const candidate:Candidate={normalizationIds:selected,mappingId:mappingId||null,controls:independent,expectedRevision:status.data.revision,expectedPublicationId:status.data.activePublicationId};
   const value=await api<Preview>(base+'/commerce-publications/preview',identity,{method:'POST',body:candidate});setPreview({...value,candidate});setNotice('Bản xem trước đã được tính từ các nguồn đã chọn. Chưa công bố.');
  }else if(action==='publish'){
   if(!preview)throw new ApiError('PUBLICATION_PREVIEW_REQUIRED',409);
   await api(base+'/commerce-publications',identity,{method:'POST',body:{...preview.candidate,previewHash:preview.previewHash,reason}});setPreview(null);setSelected([]);setReason('');setNotice('Đã công bố bản đã duyệt. Các số vẫn được ghi rõ là tạm tính trong phạm vi nguồn.');
  }else if(typeof action==='object'&&'normalize' in action){
   const value=await api<CommerceBuild>(base+'/commerce-normalizations',identity,{method:'POST',body:{receiptId:action.normalize}});setPreview(null);setNotice(value.state==='QUARANTINED'?'Bản nhập bị cách ly: '+value.reasonCode:'Đã chuẩn hóa. Chọn bản để kiểm tra và công bố.');
  }else if(typeof action==='object'&&'connection' in action){
   await api(base+'/commerce-connections/'+action.connection.id,identity,{method:'PUT',revision:action.connection.revision,body:{state:action.state,reason:action.reason}});setPreview(null);setNotice('Đã đổi phạm vi cho phép. Báo cáo dùng lần cấp quyền cũ sẽ bị khóa; cần nhập lại nguồn sau khi cho phép lại.');
  }
  await refresh();
 }});
 const changeSelection=(id:string,checked:boolean)=>{setSelected(ids=>checked?[...ids,id]:ids.filter(x=>x!==id));setPreview(null);};
 const busy=mutation.isPending;
 if(connections.isPending||receipts.isPending||builds.isPending||head.isPending)return <Loading/>;
 const failure=connections.error??receipts.error??builds.error??head.error;
 if(failure)return <ErrorState error={failure} retry={()=>{void refresh();}}/>;
 return <>
 <div className="page-title"><div><p className="eyebrow">TỪ BẰNG CHỨNG ĐẾN BẢN CÔNG BỐ</p><h1>Nhập có kiểm tra. Công bố có chủ đích.</h1><p>Bản xuất theo hợp đồng Lumi, tối đa 100 bản ghi và 48 KB mỗi tệp. Đây chưa phải trình nhập tệp gốc bất kỳ từ sàn hoặc một kết nối API.</p></div><Link className="inline-link" to="/money">Xem bản thương mại →</Link></div>
 <div className="step-strip" aria-label="Các bước xử lý"><span>01 · Cho phép nguồn</span><span>02 · Giữ bản gốc</span><span>03 · Chuẩn hóa</span><span>04 · Duyệt & công bố</span></div>
 {mutation.isError&&<ErrorState error={mutation.error}/>} {notice&&<div className="notice" role="status">{notice}</div>}
 <div className="config-grid mt-6"><Card><CardHeader><CardTitle>01. Phạm vi nguồn được cho phép</CardTitle></CardHeader><CardContent><form className="commerce-form" onSubmit={e=>{e.preventDefault();mutation.mutate('source');}}>
 <label>Mã kết nối<input required pattern="[a-z0-9_-]{1,64}" maxLength={64} value={sourceId} onChange={e=>setSourceId(e.target.value)} placeholder="orders-export"/></label>
 <div className="form-grid"><label>Nguồn<select value={provider} onChange={e=>setProvider(e.target.value)}>{[['generic','Bản xuất được duyệt'],['nhanh','Nhanh'],['haravan','Haravan'],['shopee','Shopee']].map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label>Loại dữ liệu<select value={resource} onChange={e=>setResource(e.target.value)}><option value="orders">Đơn hàng</option><option value="settlements">Bảng đối soát</option><option value="inventory">Quan sát tồn kho</option></select></label></div>
 <label>Mã tài khoản nguồn<input required maxLength={128} value={account} onChange={e=>setAccount(e.target.value)} placeholder="Mã tài khoản trong bản xuất"/></label>
 <label>Tham chiếu bằng chứng cho phép<input required maxLength={128} value={approval} onChange={e=>setApproval(e.target.value)} placeholder="Mã biên bản hoặc xác nhận của chủ dữ liệu"/></label>
 <Button type="submit" disabled={busy}>Cho phép bản xuất</Button><small>Không nhập khóa API, mật khẩu hay token vào các trường này.</small></form></CardContent></Card>
 <Card><CardHeader><CardTitle>02. Lưu bản xuất làm bằng chứng</CardTitle></CardHeader><CardContent><form className="commerce-form" onSubmit={e=>{e.preventDefault();mutation.mutate('upload');}}>
 <label>Kết nối đã cho phép<select required value={connectionId} onChange={e=>setConnectionId(e.target.value)}><option value="">Chọn nguồn</option>{connections.data!.connections.filter(c=>c.state==='active').map(c=><option key={c.id} value={c.id}>{c.id} · {c.resourceType} · {c.sourceAccountId}</option>)}</select></label>
 <label>Tệp JSON theo hợp đồng Lumi<input required type="file" accept=".json,application/json" onChange={e=>{setFile(e.target.files?.[0]??null);setDeliveryId('export_'+crypto.randomUUID());}}/></label>
 <label>Mã lần gửi<input required maxLength={128} value={deliveryId} onChange={e=>setDeliveryId(e.target.value)}/></label>
 <Button type="submit" disabled={busy||!file||!connectionId}>Lưu bằng chứng gốc</Button>
 <p className="muted">Gửi lại cùng mã và cùng nội dung sẽ dùng lại bằng chứng cũ. Không tái sử dụng mã cho dữ liệu đã thay đổi. Định dạng tiền là chuỗi số nguyên VND; giá vốn chưa biết phải để null.</p>
 </form><details className="mt-6"><summary>Hợp đồng và tệp mẫu</summary><p className="muted">Các tệp tổng hợp trong <code>examples/commerce/</code> của kho mã chỉ dùng thử. Tệp gốc từ nhà cung cấp cần bộ chuyển đổi đã được kiểm tra; đổi tên nhãn nguồn không phải là xác minh nguồn.</p></details></CardContent></Card></div>
 <Card className="mt-6"><CardHeader><CardTitle>03. Bằng chứng và kết quả chuẩn hóa</CardTitle></CardHeader><CardContent>
 {!receipts.data!.receipts.length?<Empty>Chưa có bản xuất nào được giữ lại.</Empty>:<div className="table-scroll" role="region" aria-label="Bằng chứng đã nhận" tabIndex={0}><table><thead><tr><th>Nguồn / mã bằng chứng</th><th>Trạng thái</th><th>Hành động</th></tr></thead><tbody>{receipts.data!.receipts.map(r=><tr key={r.receiptId}><td>{r.connectionId}<small><code>{r.receiptId}</code></small></td><td>{r.state}</td><td><Button variant="outline" disabled={busy||r.state==='REVOKED'} onClick={()=>mutation.mutate({normalize:r.receiptId})}>{r.normalizedRevision?'Kiểm tra lại':'Chuẩn hóa'}</Button></td></tr>)}</tbody></table></div>}
 <div className="build-list mt-6">{builds.data!.normalizations.map(n=><div className="build-row" key={n.normalizationId}><label><input type="checkbox" checked={selected.includes(n.normalizationId)} disabled={n.state!=='NORMALIZED'||busy||selected.length>=10&&!selected.includes(n.normalizationId)} onChange={e=>changeSelection(n.normalizationId,e.target.checked)}/><span><strong>{n.state==='NORMALIZED'?`${n.recordCount} bản ghi đã chuẩn hóa`:`Cách ly: ${n.reasonCode}`}</strong><small>{localInstant(n.createdAt)} · <code>{n.normalizationId}</code></small></span></label>{n.state==='NORMALIZED'&&<StagingPreview base={base} identity={identity} normalizationId={n.normalizationId}/>}</div>)}</div>
 <small>Chọn tối đa 10 nguồn cho một phạm vi có cùng kỳ. Không chọn hai ảnh chụp của cùng tài khoản và loại dữ liệu trong một bản công bố.</small>
 </CardContent></Card>
 <Card className="mt-6"><CardHeader><CardTitle>04. Kiểm soát, danh tính và duyệt số</CardTitle></CardHeader><CardContent>
 <div className="commerce-form"><details><summary>Số kiểm soát độc lập và liên kết đa nguồn</summary><div className="stack mt-4"><label>Số kiểm soát (JSON)<textarea rows={6} spellCheck={false} value={controls} onChange={e=>{setControls(e.target.value);setPreview(null);}}/></label><small>Mỗi dòng: normalizationId, recordCount, netSales hoặc null, expectedSettlement hoặc null, evidenceRef. Nhập từ báo cáo kiểm soát khác; không sao chép số vừa tính để giả lập kiểm chứng độc lập.</small><label>Mã bản liên kết danh tính (không bắt buộc với một nguồn)<input value={mappingId} onChange={e=>{setMappingId(e.target.value);setPreview(null);}}/></label><label>Bản liên kết cần duyệt (JSON)<textarea rows={5} spellCheck={false} value={mappingJson} onChange={e=>setMappingJson(e.target.value)}/></label><Button variant="outline" disabled={busy} onClick={()=>mutation.mutate('mapping')}>Lưu bản liên kết đã duyệt</Button><small>entries gồm sourceKey, canonicalId, priority. Số ưu tiên nhỏ hơn là nguồn được chọn. Không gộp hai đơn chỉ vì cùng giá trị hoặc thời điểm.</small></div></details>
 <Button disabled={busy||!selected.length} onClick={()=>mutation.mutate('preview')}>Tạo bản xem trước ({selected.length} nguồn)</Button>
 </div>
 {preview&&<div className="mt-6"><div className="quality-note">Bản xem trước, chưa công bố. Các cảnh báo vẫn được giữ khi duyệt.</div><ReportMetrics report={preview.report}/><ReportEvidence report={preview.report}/><form className="commerce-form mt-6" onSubmit={(e:FormEvent)=>{e.preventDefault();mutation.mutate('publish');}}><label>Lý do duyệt và phạm vi đã kiểm tra<input required maxLength={200} value={reason} onChange={e=>setReason(e.target.value)}/></label><Button type="submit" disabled={busy}>Công bố bản đã duyệt</Button><small>Việc công bố không chứng nhận độ đầy đủ nguồn và không gửi lệnh sang hệ thống bán hàng.</small></form></div>}
 </CardContent></Card>
 <Card className="mt-6"><CardHeader><CardTitle>Kiểm soát quyền dùng nguồn</CardTitle></CardHeader><CardContent><div className="source-controls">{connections.data!.connections.map(c=><SourceState key={`${c.id}:${c.revision}`} connection={c} busy={busy} onChange={(state,reason)=>mutation.mutate({connection:c,state,reason})}/>)}</div><p className="muted">Dừng hoặc thu hồi quyền sẽ chặn bản công bố phụ thuộc quyền cũ. Thu hồi là trạng thái cuối, không thể bật lại kết nối đó.</p></CardContent></Card>
 </>;
}
function SourceState({connection:c,busy,onChange}:{connection:CommerceConnection;busy:boolean;onChange:(state:string,reason:string)=>void}){
 const [state,setState]=useState(c.state==='active'?'paused':'active'),[reason,setReason]=useState('');
 return <details><summary>{c.id} · {c.sourceAccountId} · {c.state}</summary>{c.state!=='revoked'&&<form className="commerce-form compact" onSubmit={e=>{e.preventDefault();onChange(state,reason);}}><label>Đổi quyền nguồn<select value={state} onChange={e=>setState(e.target.value)}>{c.state!=='active'&&<option value="active">Cho phép lại, yêu cầu nhập mới</option>}{c.state==='active'&&<option value="paused">Tạm dừng</option>}<option value="revoked">Thu hồi vĩnh viễn kết nối</option></select></label><label>Lý do thay đổi<input required maxLength={200} value={reason} onChange={e=>setReason(e.target.value)}/></label><Button type="submit" variant="outline" disabled={busy}>Xác nhận đổi quyền</Button></form>}</details>;
}

function StagingPreview({base,identity,normalizationId}:{base:string;identity:string;normalizationId:string}){
 const [open,setOpen]=useState(false);const q=useQuery({queryKey:['commerce-staging',identity,base,normalizationId],enabled:open,queryFn:({signal})=>api<{data:unknown}>(base+'/commerce-staging/'+normalizationId,identity,{signal})});
 return <details onToggle={e=>setOpen(e.currentTarget.open)}><summary>Xem danh tính và bản chuẩn hóa</summary>{open&&(q.isPending?<Loading/>:q.isError?<ErrorState error={q.error}/>:<pre className="json-inspector">{JSON.stringify(q.data.data,null,2)}</pre>)}</details>;
}
