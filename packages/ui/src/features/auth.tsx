import {useState} from 'react';
import {api,message} from '../lib/api.ts';
import {Button} from '../components/ui/button.tsx';
import {Input} from '../components/ui/input.tsx';
import {Card,CardContent,CardHeader,CardTitle} from '../components/ui/card.tsx';

/** First-run initialization. Offered only while the installation is
 * uninitialized; the server closes it permanently after success. */
export function SetupScreen({onDone}:{onDone:()=>void}){
 const [name,setName]=useState('');const [login,setLogin]=useState('');const [displayName,setDisplayName]=useState('');const [password,setPassword]=useState('');const [setupToken,setSetupToken]=useState('');
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const submit=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setError('');
  try{await api('/api/setup',undefined,{method:'POST',body:{name,login,displayName:displayName||login.split('@')[0],password,setupToken:setupToken||undefined}});onDone();}
  catch(err){setError(message(err));}finally{setBusy(false);}};
 return <main className="state" style={{maxWidth:480,margin:'8vh auto',display:'block'}}><Card><CardHeader><p className="eyebrow">THIẾT LẬP LẦN ĐẦU</p><CardTitle>Khởi tạo cài đặt Lumi BI</CardTitle></CardHeader><CardContent>
  <p className="metric-definition">Tạo cài đặt và tài khoản chủ doanh nghiệp đầu tiên. Sau khi khởi tạo, màn hình này đóng vĩnh viễn.</p>
  <form onSubmit={submit} style={{display:'grid',gap:12}}>
   <label>Tên cài đặt<Input required value={name} onChange={e=>setName(e.target.value)} placeholder="Ví dụ: ACME BI"/></label>
   <label>Email đăng nhập<Input required type="email" value={login} onChange={e=>setLogin(e.target.value)} placeholder="admin@congty.vn"/></label>
   <label>Tên hiển thị<Input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Người quản trị"/></label>
   <label>Mật khẩu (tối thiểu 10 ký tự)<Input required type="password" minLength={10} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label>
   <label>Mã thiết lập (nếu máy chủ cấu hình SETUP_TOKEN)<Input value={setupToken} onChange={e=>setSetupToken(e.target.value)} autoComplete="off"/></label>
   {error&&<p role="alert" className="quality-note">{error}</p>}
   <Button type="submit" disabled={busy}>{busy?'Đang khởi tạo…':'Khởi tạo cài đặt'}</Button>
  </form></CardContent></Card></main>;
}

/** Direct application sign-in with local credentials. */
export function SignInScreen({onDone}:{onDone:()=>void}){
 const [login,setLogin]=useState('');const [password,setPassword]=useState('');
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const submit=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setError('');
  try{await api('/api/auth/login',undefined,{method:'POST',body:{login,password}});onDone();}
  catch(err){setError(message(err));}finally{setBusy(false);}};
 return <main className="state" style={{maxWidth:420,margin:'10vh auto',display:'block'}}><Card><CardHeader><p className="eyebrow">ĐĂNG NHẬP</p><CardTitle>Lumi BI</CardTitle></CardHeader><CardContent>
  <form onSubmit={submit} style={{display:'grid',gap:12}}>
   <label>Email<Input required type="email" value={login} onChange={e=>setLogin(e.target.value)} autoComplete="username"/></label>
   <label>Mật khẩu<Input required type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>
   {error&&<p role="alert" className="quality-note">{error}</p>}
   <Button type="submit" disabled={busy}>{busy?'Đang đăng nhập…':'Đăng nhập'}</Button>
  </form></CardContent></Card></main>;
}
