import {useState} from 'react';
import {api,message} from '../lib/api.ts';
import {Button} from '../components/ui/button.tsx';
import {Input} from '../components/ui/input.tsx';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '../components/ui/card.tsx';

// Centered, self-contained shell: these screens render before any app chrome
// exists, so their layout travels with the component, not the consumer CSS.
const authShell='grid min-h-dvh place-items-center bg-background px-4 py-10';
const field='grid gap-1.5';
const fieldLabel='text-sm font-medium text-foreground';
const alert='rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-left text-sm text-red-800';

/** First-run initialization. Offered only while the installation is
 * uninitialized; the server closes it permanently after success. */
export function SetupScreen({onDone}:{onDone:()=>void}){
 const [name,setName]=useState('');const [login,setLogin]=useState('');const [displayName,setDisplayName]=useState('');const [password,setPassword]=useState('');const [setupToken,setSetupToken]=useState('');
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const submit=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setError('');
  try{await api('/api/setup',undefined,{method:'POST',body:{name,login,displayName:displayName||login.split('@')[0],password,setupToken:setupToken||undefined}});onDone();}
  catch(err){setError(message(err));}finally{setBusy(false);}};
 return <main className={authShell}>
  <div className="w-full max-w-md"><Card className="shadow-sm">
   <CardHeader>
    <p className="eyebrow">THIẾT LẬP LẦN ĐẦU</p>
    <CardTitle className="mt-1 text-xl tracking-tight">Khởi tạo cài đặt Lumi BI</CardTitle>
    <CardDescription>Tạo cài đặt và tài khoản chủ doanh nghiệp đầu tiên. Sau khi khởi tạo, màn hình này đóng vĩnh viễn.</CardDescription>
   </CardHeader>
   <CardContent>
    <form onSubmit={submit} className="grid gap-4">
     <label className={field}><span className={fieldLabel}>Tên cài đặt</span><Input required value={name} onChange={e=>setName(e.target.value)} placeholder="Ví dụ: ACME BI"/></label>
     <label className={field}><span className={fieldLabel}>Email đăng nhập</span><Input required type="email" value={login} onChange={e=>setLogin(e.target.value)} placeholder="admin@congty.vn" autoComplete="username"/></label>
     <label className={field}><span className={fieldLabel}>Tên hiển thị</span><Input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Người quản trị"/></label>
     <label className={field}><span className={fieldLabel}>Mật khẩu (tối thiểu 10 ký tự)</span><Input required type="password" minLength={10} value={password} onChange={e=>setPassword(e.target.value)} autoComplete="new-password"/></label>
     <label className={field}><span className={fieldLabel}>Mã thiết lập (nếu máy chủ cấu hình SETUP_TOKEN)</span><Input value={setupToken} onChange={e=>setSetupToken(e.target.value)} autoComplete="off"/></label>
     {error&&<p role="alert" className={alert}>{error}</p>}
     <Button type="submit" disabled={busy} className="w-full">{busy?'Đang khởi tạo…':'Khởi tạo cài đặt'}</Button>
    </form>
   </CardContent>
  </Card></div>
 </main>;
}

/** Direct application sign-in with local credentials. */
export function SignInScreen({onDone}:{onDone:()=>void}){
 const [login,setLogin]=useState('');const [password,setPassword]=useState('');
 const [error,setError]=useState('');const [busy,setBusy]=useState(false);
 const submit=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setError('');
  try{await api('/api/auth/login',undefined,{method:'POST',body:{login,password}});onDone();}
  catch(err){setError(message(err));}finally{setBusy(false);}};
 return <main className={authShell}>
  <div className="w-full max-w-sm"><Card className="shadow-sm">
   <CardHeader>
    <p className="eyebrow">ĐĂNG NHẬP</p>
    <CardTitle className="mt-1 text-xl tracking-tight">Lumi BI</CardTitle>
    <CardDescription>Đăng nhập bằng tài khoản của cài đặt này.</CardDescription>
   </CardHeader>
   <CardContent>
    <form onSubmit={submit} className="grid gap-4">
     <label className={field}><span className={fieldLabel}>Email</span><Input required type="email" value={login} onChange={e=>setLogin(e.target.value)} autoComplete="username" placeholder="admin@congty.vn"/></label>
     <label className={field}><span className={fieldLabel}>Mật khẩu</span><Input required type="password" value={password} onChange={e=>setPassword(e.target.value)} autoComplete="current-password"/></label>
     {error&&<p role="alert" className={alert}>{error}</p>}
     <Button type="submit" disabled={busy} className="w-full">{busy?'Đang đăng nhập…':'Đăng nhập'}</Button>
    </form>
   </CardContent>
  </Card></div>
 </main>;
}
