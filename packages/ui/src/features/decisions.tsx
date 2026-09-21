import {useState} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {api,message,type InstallationUser,type CommerceFinding,type CommerceDecision} from '../lib/api.ts';
import {Card,CardHeader,CardTitle,CardContent} from '../components/ui/card.tsx';
import {Button} from '../components/ui/button.tsx';
import {Loading,Empty,ErrorState} from '../components/states.tsx';

const NEXT_STATES:Record<string,string[]>= {OPEN:['INVESTIGATING','ACCEPTED_LIMITATION'],INVESTIGATING:['AWAITING_OUTCOME','ACCEPTED_LIMITATION'],AWAITING_OUTCOME:['INVESTIGATING','RESOLVED','ACCEPTED_LIMITATION']};
const LABELS:Record<string,string>={OPEN:'Mở',INVESTIGATING:'Đang điều tra',AWAITING_OUTCOME:'Chờ kết quả',RESOLVED:'Đã giải quyết',ACCEPTED_LIMITATION:'Chấp nhận giới hạn'};

export function DecisionsPage({user,identity}:{user:InstallationUser;identity:string}){
 const client=useQueryClient();
 const findings=useQuery({queryKey:['findings',identity],queryFn:({signal})=>api<{publicationId:string|null;findings:CommerceFinding[];noPublishedData:boolean}>('/api/commerce/findings',identity,{signal})});
 const decisions=useQuery({queryKey:['decisions',identity],queryFn:({signal})=>api<{decisions:CommerceDecision[]}>('/api/commerce/decisions',identity,{signal})});
 const [note,setNote]=useState('');
 const invalidate=()=>{client.invalidateQueries({queryKey:['findings',identity]});client.invalidateQueries({queryKey:['decisions',identity]});};
 const openDecision=useMutation({mutationFn:(finding:CommerceFinding)=>api('/api/commerce/decisions',identity,{method:'POST',body:{publicationId:findings.data?.publicationId,findingId:finding.id,rationale:`Xử lý quan sát: ${finding.title}`,dueOn:null}}),
  onSuccess:()=>{setNote('Đã mở việc trong sổ quyết định.');invalidate();},onError:error=>setNote(message(error))});
 const transition=useMutation({mutationFn:(input:{decision:CommerceDecision;state:string})=>api(`/api/commerce/decisions/${input.decision.id}`,identity,{method:'PUT',body:{state:input.state,note:`Chuyển sang ${input.state} từ giao diện.`,expectedRevision:input.decision.revision}}),
  onSuccess:()=>{setNote('Đã cập nhật.');invalidate();},onError:error=>setNote(message(error))});
 if(findings.isPending||decisions.isPending)return <Loading/>;
 if(findings.isError||decisions.isError)return <ErrorState error={findings.error??decisions.error} retry={()=>{findings.refetch();decisions.refetch();}}/>;
 const owner=user.role==='owner';
 return <div className="page-title"><div><p className="eyebrow">QUYẾT ĐỊNH</p><h1>Quan sát và sổ quyết định</h1><p>Chỉ ghi nhận điều kiện đã quan sát trong bản công bố. Không suy diễn nguyên nhân; kết quả phải có bằng chứng công bố mới.</p></div>
 <div style={{display:'grid',gap:12}}>
 <Card><CardHeader><CardTitle>Quan sát hiện hành</CardTitle></CardHeader><CardContent>
  {findings.data.noPublishedData||!findings.data.findings.length?<Empty>Không có quan sát nào trên bản công bố hiện tại.</Empty>:<div className="table-scroll"><table><thead><tr><th>Quan sát</th><th>Đối tượng</th><th>Giá trị</th><th>Bước tiếp theo</th>{owner&&<th>Thao tác</th>}</tr></thead><tbody>
  {findings.data.findings.map(finding=><tr key={finding.id}><td><strong>{finding.title}</strong><br/><span className="metric-definition">{finding.explanation}</span></td><td>{finding.entityType}: <code>{finding.entityId.slice(0,16)}…</code></td><td>{finding.value??'Chưa xác định'}</td><td>{finding.nextStep}</td>
  {owner&&<td><Button size="sm" variant="outline" disabled={openDecision.isPending} onClick={()=>openDecision.mutate(finding)}>Mở việc</Button></td>}</tr>)}
  </tbody></table></div>}
 </CardContent></Card>
 <Card><CardHeader><CardTitle>Sổ quyết định</CardTitle></CardHeader><CardContent>
  {!decisions.data.decisions.length?<Empty>Chưa có việc nào được ghi nhận.</Empty>:<div className="table-scroll"><table><thead><tr><th>Việc</th><th>Trạng thái</th><th>Lý do</th><th>Hạn</th>{owner&&<th>Chuyển trạng thái</th>}</tr></thead><tbody>
  {decisions.data.decisions.map(decision=><tr key={decision.id}><td><strong>{decision.finding?.title??decision.finding_id}</strong><br/><code>{decision.id.slice(0,14)}…</code></td><td>{LABELS[decision.state]??decision.state}</td><td>{decision.rationale}</td><td>{decision.due_on??'—'}</td>
  {owner&&<td><div style={{display:'flex',gap:6,flexWrap:'wrap'}}>{(NEXT_STATES[decision.state]??[]).map(next=><Button key={next} size="sm" variant={next==='RESOLVED'?'default':'outline'} disabled={transition.isPending} onClick={()=>transition.mutate({decision,state:next})}>{LABELS[next]??next}</Button>)}</div></td>}</tr>)}
  </tbody></table></div>}
  <span role="status">{note}</span>
 </CardContent></Card>
 </div></div>;
}
