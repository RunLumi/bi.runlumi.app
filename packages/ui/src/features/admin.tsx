import {useState} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {api,message,type InstallationUser} from '../lib/api.ts';
import {Card,CardHeader,CardTitle,CardContent} from '../components/ui/card.tsx';
import {Input} from '../components/ui/input.tsx';
import {Button} from '../components/ui/button.tsx';
import {Loading,Empty,ErrorState} from '../components/states.tsx';

interface ManagedUser {id:string;issuer:string;subject:string;displayName:string;role:'owner'|'editor'|'viewer';state:'active'|'disabled'}

export function AdminPage({user,identity}:{user:InstallationUser;identity:string}){
 if(user.role!=='owner')return <Empty>Quản trị người dùng chỉ dành cho chủ doanh nghiệp.</Empty>;
 return <AdminConsole user={user} identity={identity}/>;
}
function AdminConsole({user,identity}:{user:InstallationUser;identity:string}){
 const client=useQueryClient();
 const list=useQuery({queryKey:['users',identity],queryFn:({signal})=>api<{users:ManagedUser[]}>('/api/users',identity,{signal})});
 const [login,setLogin]=useState('');const [displayName,setDisplayName]=useState('');const [role,setRole]=useState('viewer');const [password,setPassword]=useState('');const [note,setNote]=useState('');
 const create=useMutation({mutationFn:()=>api('/api/users',identity,{method:'POST',body:{login,displayName,role,password}}),
  onSuccess:()=>{setNote('Đã tạo người dùng.');setLogin('');setDisplayName('');setPassword('');client.invalidateQueries({queryKey:['users',identity]});},
  onError:(error)=>setNote(message(error))});
 const change=useMutation({mutationFn:(input:{userId:string;body:Record<string,unknown>})=>api(`/api/users/${input.userId}`,identity,{method:'PUT',body:input.body}),
  onSuccess:()=>{setNote('Đã cập nhật.');client.invalidateQueries({queryKey:['users',identity]});},
  onError:(error)=>setNote(message(error))});
 if(list.isPending)return <Loading/>;if(list.isError)return <ErrorState error={list.error} retry={()=>list.refetch()}/>;
 return <div className="page-title"><div><p className="eyebrow">QUẢN TRỊ</p><h1>Người dùng và vai trò</h1><p>Người dùng, phiên và quyền của cài đặt này. Không có dịch vụ bên ngoài nào tham gia xác thực.</p></div>
 <div style={{display:'grid',gap:12,maxWidth:720}}>
 <Card><CardHeader><CardTitle>Tạo người dùng</CardTitle></CardHeader><CardContent><form style={{display:'grid',gap:10}} onSubmit={event=>{event.preventDefault();create.mutate();}}>
  <label>Email đăng nhập<Input required type="email" value={login} onChange={e=>setLogin(e.target.value)}/></label>
  <label>Tên hiển thị<Input value={displayName} onChange={e=>setDisplayName(e.target.value)}/></label>
  <label>Vai trò<select value={role} onChange={e=>setRole(e.target.value)}><option value="viewer">Người xem</option><option value="editor">Biên tập</option><option value="owner">Chủ doanh nghiệp</option></select></label>
  <label>Mật khẩu ban đầu<Input required type="password" minLength={10} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label>
  <Button type="submit" disabled={create.isPending}>Tạo người dùng</Button>
  <span role="status">{note}</span></form></CardContent></Card>
 <Card><CardHeader><CardTitle>Người dùng hiện có</CardTitle></CardHeader><CardContent><div className="table-scroll"><table><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>
  {list.data.users.map(item=><tr key={item.id}><td>{item.displayName}<br/><code>{item.subject}</code></td><td>
   <select value={item.role} aria-label={`Vai trò của ${item.displayName}`} onChange={e=>change.mutate({userId:item.id,body:{role:e.target.value}})} disabled={item.id===user.id}>
    <option value="viewer">Người xem</option><option value="editor">Biên tập</option><option value="owner">Chủ doanh nghiệp</option></select></td>
   <td>{item.state==='active'?'Hoạt động':'Đã vô hiệu'}</td>
   <td>{item.id!==user.id&&<Button size="sm" variant="outline" onClick={()=>change.mutate({userId:item.id,body:{state:item.state==='active'?'disabled':'active'}})}>{item.state==='active'?'Vô hiệu hóa':'Kích hoạt'}</Button>}</td></tr>)}
  </tbody></table></div><p className="metric-definition">Không thể vô hiệu hóa hoặc hạ quyền chủ doanh nghiệp cuối cùng. Người dùng bị vô hiệu hóa mất toàn bộ phiên đăng nhập ngay lập tức.</p>
  <span role="status">{note}</span></CardContent></Card></div></div>;
}
