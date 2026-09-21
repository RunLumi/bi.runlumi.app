import {Component,useEffect,useState,type ReactNode,type ComponentType} from 'react';
import {QueryClient,QueryClientProvider,useQuery,useQueryClient} from '@tanstack/react-query';
import {BrowserRouter,NavLink,Route,Routes} from 'react-router-dom';
import {api,type Session,type InstallationUser} from './lib/api.ts';
import {Empty,ErrorState,Loading} from './components/states.tsx';
import {SetupScreen,SignInScreen} from './features/auth.tsx';

export interface NavContext {user:InstallationUser|null;platformOperator:boolean}
export interface PageContext {user:InstallationUser|null;identity:string;demo:boolean;session:Session}
export interface AppPage {
  path:string;
  label:string;
  glyph?:ComponentType;
  /** When the entry appears in navigation. Absent pages still resolve as routes. */
  nav?:(ctx:NavContext)=>boolean;
  render:(ctx:PageContext)=>ReactNode;
}
export interface AppBrand {name:ReactNode;logoSrc:string;logoAlt:string;workspaceLabel:string;footer:ReactNode}
export interface AppLabels {
  skipToContent:string;installationLabel:string;installationAriaLabel:string;navAriaLabel:string;
  noUsersOption:string;operatorBar:string;notFound:string;demoNotice:string;demoIdentityAriaLabel:string;
}
export interface AppConfig {brand:AppBrand;labels:AppLabels;pages:AppPage[];demoIdentities:string[]}

class Boundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}componentDidCatch(error:unknown){console.error('Lumi UI boundary',error);}render(){return this.state.failed?<main className="state" role="alert">Giao diện chưa sẵn sàng. Tải lại trang để bắt đầu phiên mới.</main>:this.props.children;}}

function IdentityScope({identity,onIdentity,epoch,onEpoch,config}:{identity:string;onIdentity:(value:string)=>void;epoch:number;onEpoch:()=>void;config:AppConfig}){
 // A new client per identity AND per authentication epoch. Signed-out or
 // switched users never inherit another principal's query cache.
 const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{staleTime:0,gcTime:60_000,retry:(n,e)=>!(e instanceof Error&&'status'in e&&(e as {status:number}).status<500)&&n<1,refetchOnWindowFocus:true}}}));
 return <QueryClientProvider client={client}><Gate identity={identity} onIdentity={onIdentity} epoch={epoch} onEpoch={onEpoch} config={config}/></QueryClientProvider>;
}

function Gate({identity,onIdentity,epoch,onEpoch,config}:{identity:string;onIdentity:(value:string)=>void;epoch:number;onEpoch:()=>void;config:AppConfig}){
 const client=useQueryClient();
 const sessionQuery=useQuery({queryKey:['session',identity,epoch],queryFn:({signal})=>api<Session>('/api/session',identity,{signal}),retry:false});
 if(sessionQuery.isPending)return <Loading/>;
 if(sessionQuery.isError){
  const status=(sessionQuery.error as {status?:number}).status;
  if(status===401||status===403||status===409){
   // Unauthenticated or fresh installation: offer first-run setup, else sign-in.
   const done=()=>{client.removeQueries();onEpoch();};
   return <SignInUninitialized onDone={done}/>;
  }
  return <ErrorState error={sessionQuery.error} retry={()=>sessionQuery.refetch()}/>;
 }
 const session=sessionQuery.data;const user=session.user;
 const navCtx:NavContext={user,platformOperator:false};
 const visible=config.pages.filter(p=>p.nav?.(navCtx));
 const signOut=async()=>{try{await api('/api/auth/logout',undefined,{method:'POST'});}catch{/* session is gone either way */}client.removeQueries();onEpoch();};
 return <div className="app-shell"><a className="skip-link" href="#main-content">{config.labels.skipToContent}</a><aside className="sidebar"><a className="brand" href="/"><img src={config.brand.logoSrc} width="28" height="28" alt={config.brand.logoAlt}/><strong>{config.brand.name}</strong></a><p className="workspace-label">{config.brand.workspaceLabel}</p>
 <p className="user-label">{session.installation.name??user.name}</p>
 <nav aria-label={config.labels.navAriaLabel}>{visible.map(p=><NavLink key={p.path} to={p.path} end={p.path==='/'}>{p.glyph?<p.glyph/>:null}{p.label}</NavLink>)}</nav>
 <div className="sidebar-footer">{config.brand.footer}<p className="user-label">{user.displayName||user.name} · {user.role}</p><button type="button" className="link" onClick={signOut}>Đăng xuất</button></div></aside><div className="main-shell"><header className="topbar"><span>{`${user.displayName||user.name} / ${user.role}`}</span><div>{session.demo&&<label className="demo-switch"><span>DEMO</span><select aria-label={config.labels.demoIdentityAriaLabel} value={identity||(config.demoIdentities[0]??'')} onChange={e=>onIdentity(e.target.value)}>{config.demoIdentities.map(x=><option key={x}>{x}</option>)}</select></label>}</div></header>
 {session.demo&&<div className="demo-notice">{config.labels.demoNotice}</div>}
 <main id="main-content" key={`${epoch}:${identity}:${user.id}`}><Routes>{config.pages.map(p=><Route key={p.path} path={p.path} element={p.render({user,identity,demo:session.demo,session})}/>)}<Route path="*" element={<Empty>{config.labels.notFound}</Empty>}/></Routes></main></div></div>;
}

/** Sign-in screen that also offers first-run setup when the server is fresh. */
function SignInUninitialized({onDone}:{onDone:()=>void}){
 const [setupOpen,setSetupOpen]=useState<boolean|null>(null);
 useEffect(()=>{
  let alive=true;
  api<{initialized:boolean}>('/api/setup/status',undefined).then(s=>{if(alive)setSetupOpen(!s.initialized);}).catch(()=>{if(alive)setSetupOpen(false);});
  return ()=>{alive=false;};
 },[]);
 if(setupOpen===null)return <Loading/>;
 return setupOpen?<SetupScreen onDone={onDone}/>:<SignInScreen onDone={onDone}/>;
}

/** Compose a customer application from reviewed pages, navigation and brand config.
 * Pages are real React components; reserved behaviors (authentication, session,
 * cache isolation per identity) stay implemented here in the shared core. */
export function createApp(config:AppConfig):ComponentType{
 return function CustomerApp(){
  const [identity,setIdentity]=useState('');
  const [epoch,setEpoch]=useState(0);
  return <Boundary><BrowserRouter><IdentityScope key={`${epoch}:${identity}`} identity={identity} onIdentity={setIdentity} epoch={epoch} onEpoch={()=>setEpoch(value=>value+1)} config={config}/></BrowserRouter></Boundary>;};
}
