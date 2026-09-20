import {useState,Component,type ReactNode} from 'react';import {QueryClient,QueryClientProvider,useQuery} from '@tanstack/react-query';
import {BrowserRouter,NavLink,Route,Routes,Navigate} from 'react-router-dom';
import {api,type Session,ApiError} from '@/lib/api';import {DashboardPage} from '@/features/dashboard';import {ConfigurationPage} from '@/features/configuration';import {ControlPage} from '@/features/control';
import {Loading,ErrorState,Empty} from '@/components/states';import {DashboardGlyph,GitGlyph,SettingsGlyph,DatabaseGlyph} from '@/components/glyphs';
class Boundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){return this.state.failed?<main className="state" role="alert">Giao diện chưa sẵn sàng. Tải lại trang để bắt đầu phiên mới.</main>:this.props.children;}}
function IdentityScope({identity,onIdentity}:{identity:string;onIdentity:(value:string)=>void}){
 // New client on identity change. Never persist or reuse another identity's query cache.
 const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{staleTime:0,gcTime:60_000,retry:(n,e)=>!(e instanceof ApiError&&e.status<500)&&n<1,refetchOnWindowFocus:true}}}));
 return <QueryClientProvider client={client}><Shell identity={identity} onIdentity={onIdentity}/></QueryClientProvider>;
}
function Shell({identity,onIdentity}:{identity:string;onIdentity:(value:string)=>void}){
 const q=useQuery({queryKey:['session',identity],queryFn:({signal})=>api<Session>('/api/session',identity,{signal})});const [tenantId,setTenantId]=useState('');
 if(q.isPending)return <Loading/>;if(q.isError)return <ErrorState error={q.error} retry={()=>q.refetch()}/>;
 const tenant=q.data.tenants.find(t=>t.id===tenantId)??q.data.tenants[0];
 return <div className="app-shell"><a className="skip-link" href="#main-content">Đến nội dung</a><aside className="sidebar"><a className="brand" href="/"><img src="/brand/lumi-logo.svg" width="28" height="28" alt=""/><strong>Lumi <span>BI</span></strong></a><p className="workspace-label">KHÔNG GIAN DỮ LIỆU</p>
 <label className="tenant-label"><span>Doanh nghiệp</span><select aria-label="Doanh nghiệp" value={tenant?.id??''} onChange={e=>setTenantId(e.target.value)} disabled={!q.data.tenants.length}>{q.data.tenants.length?q.data.tenants.map(t=><option value={t.id} key={t.id}>{t.name}</option>):<option value="">Platform operator</option>}</select></label>
 <nav aria-label="Điều hướng">{tenant&&<><NavLink to="/" end><DashboardGlyph/>Tổng quan</NavLink><NavLink to="/configuration"><GitGlyph/>Cấu hình Git & AI</NavLink></>}{q.data.platformOperator&&<NavLink to="/control"><SettingsGlyph/>Control Plane</NavLink>}</nav>
 <div className="sidebar-footer"><DatabaseGlyph/><p>D1 riêng theo tenant<br/><span>Một bộ định nghĩa dùng chung.</span></p></div></aside><div className="main-shell"><header className="topbar"><span>{tenant?`${tenant.id} / ${tenant.role}`:'RunLumi / platform operations'}</span><div>{tenant?.license&&<span className="tag">{tenant.license.plan} · {tenant.license.state}</span>}{q.data.demo&&<label className="demo-switch"><span>DEMO</span><select aria-label="Danh tính thử nghiệm" value={identity||'alpha-owner'} onChange={e=>onIdentity(e.target.value)}>{['alpha-owner','alpha-editor','alpha-viewer','beta-owner','beta-viewer','platform-admin'].map(x=><option key={x}>{x}</option>)}</select></label>}</div></header>
 {q.data.demo&&<div className="demo-notice">Dữ liệu minh họa · Không phải kết quả của khách hàng</div>}
 <main id="main-content" key={`${identity}:${tenant?.id??'control'}`}><Routes><Route path="/" element={tenant?<DashboardPage tenant={tenant} identity={identity} demo={q.data.demo}/>:q.data.platformOperator?<Navigate to="/control" replace/>:<Empty>Chưa có membership đang hiệu lực.</Empty>}/><Route path="/configuration" element={tenant?<ConfigurationPage tenant={tenant} identity={identity}/>:<Empty>Chọn doanh nghiệp được cấp quyền trước.</Empty>}/><Route path="/control" element={<ControlPage identity={identity}/>}/><Route path="*" element={<Empty>Không tìm thấy trang.</Empty>}/></Routes></main></div></div>;
}
export default function App(){const [identity,setIdentity]=useState('');return <Boundary><BrowserRouter><IdentityScope key={identity} identity={identity} onIdentity={setIdentity}/></BrowserRouter></Boundary>;}
