import {createApp,type AppConfig,type AppPage} from '@runlumi/ui/app.tsx';
import {DashboardPage} from '@runlumi/ui/features/dashboard.tsx';
import {AdminPage} from '@runlumi/ui/features/admin.tsx';
import {SourcesPage} from '@runlumi/ui/features/sources.tsx';
import {CommercePage} from '@runlumi/ui/features/commerce.tsx';
import {DecisionsPage} from '@runlumi/ui/features/decisions.tsx';
import {ReportsPage} from '@runlumi/ui/features/reports.tsx';
import {CommerceReportPage} from '@runlumi/ui/features/commerce-report.tsx';
import {DashboardGlyph,DatabaseGlyph,SettingsGlyph} from '@runlumi/ui/components/glyphs.tsx';
import type {InstallationUser} from '@runlumi/ui/lib/api.ts';
import {customerPages} from '../../customer/ui/pages.tsx';
import {manifest} from '../../customer/manifest.ts';

const guard=(render:(user:InstallationUser,identity:string,demo:boolean)=>React.ReactNode)=>{
 return ({user,identity,demo}:{user:InstallationUser|null;identity:string;demo:boolean})=>
  user?render(user,identity,demo):null;
};
const corePages:AppPage[]=[
 {path:'/',label:'Overview',glyph:DashboardGlyph,nav:()=>true,render:guard((user,identity,demo)=><DashboardPage user={user} identity={identity} demo={demo}/>)},
 {path:'/operations',label:'Operations',glyph:DashboardGlyph,nav:()=>true,render:guard((user,identity,demo)=><DashboardPage user={user} identity={identity} demo={demo}/>)},
 {path:'/sources',label:'Sources',glyph:DatabaseGlyph,nav:()=>true,render:guard((user,identity)=><SourcesPage user={user} identity={identity}/>)},
 {path:'/reports',label:'Reports',glyph:DashboardGlyph,nav:()=>true,render:guard((user,identity)=><ReportsPage user={user} identity={identity}/>)},
 {path:'/decisions',label:'Decisions',glyph:SettingsGlyph,nav:()=>true,render:guard((user,identity)=><DecisionsPage user={user} identity={identity}/>)},
 ...(manifest.modules.includes('commerce')?[
  {path:'/commerce',label:'Commerce',glyph:DatabaseGlyph,nav:({user})=>user?.role==='owner',render:guard((user,identity)=><CommercePage user={user} identity={identity}/>)},
  {path:'/commerce-report',label:'Published data',glyph:DatabaseGlyph,nav:()=>true,render:guard((user,identity)=><CommerceReportPage user={user} identity={identity}/>)}
 ]:[]),
 {path:'/admin',label:'Administration',glyph:SettingsGlyph,nav:({user})=>user?.role==='owner',render:guard((user,identity)=><AdminPage user={user} identity={identity}/>)}
];
const config:AppConfig={
 brand:{name:manifest.displayName,logoSrc:manifest.brand.logoSrc,logoAlt:manifest.brand.logoAlt,workspaceLabel:'INSTALLATION',footer:null},
 labels:{skipToContent:'Skip to content',installationLabel:'Installation',installationAriaLabel:'Installation',navAriaLabel:'Navigation',noUsersOption:'Not signed in',operatorBar:'Installation',notFound:'Not found',demoNotice:'Synthetic data',demoIdentityAriaLabel:'Demo identity'},
 demoIdentities:['local-owner'],
 pages:[...corePages,...customerPages]
};
export default createApp(config);
