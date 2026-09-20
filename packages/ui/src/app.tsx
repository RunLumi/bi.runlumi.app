import {Component,useState,type ReactNode,type ComponentType} from 'react';
import {QueryClient,QueryClientProvider,useQuery} from '@tanstack/react-query';
import {BrowserRouter,NavLink,Route,Routes} from 'react-router-dom';
import {api,type Session,type Tenant} from './lib/api.ts';
import {Empty,ErrorState,Loading} from './components/states.tsx';

export interface NavContext {tenant:Tenant|null;platformOperator:boolean}
export interface PageContext {tenant:Tenant|null;identity:string;demo:boolean;session:Session}
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
  skipToContent:string;tenantLabel:string;tenantAriaLabel:string;navAriaLabel:string;
  noTenantsOption:string;operatorBar:string;notFound:string;demoNotice:string;demoIdentityAriaLabel:string;
}
export interface AppConfig {brand:AppBrand;labels:AppLabels;pages:AppPage[];demoIdentities:string[]}

class Boundary extends Component<{children:ReactNode},{failed:boolean}>{state={failed:false};static getDerivedStateFromError(){return {failed:true};}render(){return this.state.failed?<main className="state" role="alert">Giao diện chưa sẵn sàng. Tải lại trang để bắt đầu phiên mới.</main>:this.props.children;}}

function IdentityScope({identity,onIdentity,config}:{identity:string;onIdentity:(value:string)=>void;config:AppConfig}){
 // New client on identity change. Never persist or reuse another identity's query cache.
 const [client]=useState(()=>new QueryClient({defaultOptions:{queries:{staleTime:0,gcTime:60_000,retry:(n,e)=>!(e instanceof Error&&'status'in e&&(e as {status:number}).status<500)&&n<1,refetchOnWindowFocus:true}}}));
 return <QueryClientProvider client={client}><Shell identity={identity} onIdentity={onIdentity} config={config}/></QueryClientProvider>;
}

function Shell({identity,onIdentity,config}:{identity:string;onIdentity:(value:string)=>void;config:AppConfig}){
 const q=useQuery({queryKey:['session',identity],queryFn:({signal})=>api<Session>('/api/session',identity,{signal})});const [tenantId,setTenantId]=useState('');
 if(q.isPending)return <Loading/>;if(q.isError)return <ErrorState error={q.error} retry={()=>q.refetch()}/>;
 const session=q.data;const tenant=session.tenants.find(t=>t.id===tenantId)??session.tenants[0];
 const navCtx:NavContext={tenant:tenant??null,platformOperator:session.platformOperator};
 const visible=config.pages.filter(p=>p.nav?.(navCtx));
 return <div className="app-shell"><a className="skip-link" href="#main-content">{config.labels.skipToContent}</a><aside className="sidebar"><a className="brand" href="/"><img src={config.brand.logoSrc} width="28" height="28" alt={config.brand.logoAlt}/><strong>{config.brand.name}</strong></a><p className="workspace-label">{config.brand.workspaceLabel}</p>
 <label className="tenant-label"><span>{config.labels.tenantLabel}</span><select aria-label={config.labels.tenantAriaLabel} value={tenant?.id??''} onChange={e=>setTenantId(e.target.value)} disabled={!session.tenants.length}>{session.tenants.length?session.tenants.map(t=><option value={t.id} key={t.id}>{t.name}</option>):<option value="">{config.labels.noTenantsOption}</option>}</select></label>
 <nav aria-label={config.labels.navAriaLabel}>{visible.map(p=><NavLink key={p.path} to={p.path} end={p.path==='/'}>{p.glyph?<p.glyph/>:null}{p.label}</NavLink>)}</nav>
 <div className="sidebar-footer">{config.brand.footer}</div></aside><div className="main-shell"><header className="topbar"><span>{tenant?`${tenant.id} / ${tenant.role}`:config.labels.operatorBar}</span><div>{tenant?.license&&<span className="tag">{tenant.license.plan} · {tenant.license.state}</span>}{session.demo&&<label className="demo-switch"><span>DEMO</span><select aria-label={config.labels.demoIdentityAriaLabel} value={identity||(config.demoIdentities[0]??'')} onChange={e=>onIdentity(e.target.value)}>{config.demoIdentities.map(x=><option key={x}>{x}</option>)}</select></label>}</div></header>
 {session.demo&&<div className="demo-notice">{config.labels.demoNotice}</div>}
 <main id="main-content" key={`${identity}:${tenant?.id??'control'}`}><Routes>{config.pages.map(p=><Route key={p.path} path={p.path} element={p.render({tenant:tenant??null,identity,demo:session.demo,session})}/>)}<Route path="*" element={<Empty>{config.labels.notFound}</Empty>}/></Routes></main></div></div>;
}

/** Compose a customer application from reviewed pages, navigation and brand config.
 * Pages are real React components; reserved behaviors (authentication, session,
 * cache isolation per identity) stay implemented here in the shared core. */
export function createApp(config:AppConfig):ComponentType{
 return function CustomerApp(){const [identity,setIdentity]=useState('');return <Boundary><BrowserRouter><IdentityScope key={identity} identity={identity} onIdentity={setIdentity} config={config}/></BrowserRouter></Boundary>;};
}
