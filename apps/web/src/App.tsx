import {createApp,type AppConfig} from '@runlumi/ui/app.tsx';
import {DashboardPage} from '@runlumi/ui/features/dashboard.tsx';
import {AdminPage} from '@runlumi/ui/features/admin.tsx';
import {SourcesPage} from '@runlumi/ui/features/sources.tsx';
import {CommercePage} from '@runlumi/ui/features/commerce.tsx';
import {DecisionsPage} from '@runlumi/ui/features/decisions.tsx';
import {ReportsPage} from '@runlumi/ui/features/reports.tsx';
import {CommerceReportPage} from '@runlumi/ui/features/commerce-report.tsx';
import {DashboardGlyph,DatabaseGlyph,SettingsGlyph} from '@runlumi/ui/components/glyphs.tsx';
import type {InstallationUser} from '@runlumi/ui/lib/api.ts';

const guard=(render:(user:InstallationUser,identity:string,demo:boolean)=>React.ReactNode)=>{
 return ({user,identity,demo}:{user:InstallationUser|null;identity:string;demo:boolean})=>
  user?render(user,identity,demo):<main className="state">Chưa có người dùng đăng nhập.</main>;
};
const config:AppConfig={
 brand:{name:<>Lumi <span>BI</span></>,logoSrc:'/brand/lumi-logo.svg',logoAlt:'',workspaceLabel:'KHÔNG GIAN DỮ LIỆU',footer:<><DatabaseGlyph/><p>Dữ liệu thuộc installation này<br/><span>Không có user selector.</span></p></>},
 labels:{skipToContent:'Đến nội dung',installationLabel:'Installation',installationAriaLabel:'Installation',navAriaLabel:'Điều hướng',noUsersOption:'Chưa đăng nhập',operatorBar:'Installation',notFound:'Không tìm thấy trang.',demoNotice:'Dữ liệu minh họa · Không phải kết quả của khách hàng',demoIdentityAriaLabel:'Danh tính thử nghiệm'},
 demoIdentities:['local-owner','local-editor','local-viewer'],
 pages:[
  {path:'/',label:'Tổng quan',glyph:DashboardGlyph,nav:()=>true,render:guard((user,identity,demo)=><DashboardPage user={user} identity={identity} demo={demo}/>)},
  {path:'/operations',label:'Chi phí thao tác',glyph:DashboardGlyph,nav:()=>true,render:guard((user,identity,demo)=><DashboardPage user={user} identity={identity} demo={demo}/>)},
  {path:'/sources',label:'Nguồn & nhập',glyph:DatabaseGlyph,nav:()=>true,render:guard((user,identity)=><SourcesPage user={user} identity={identity}/>)},
  {path:'/commerce',label:'Commerce',glyph:DatabaseGlyph,nav:({user})=>user?.role==='owner',render:guard((user,identity)=><CommercePage user={user} identity={identity}/>)},
  {path:'/reports',label:'Báo cáo',glyph:DashboardGlyph,nav:()=>true,render:guard((user,identity)=><ReportsPage user={user} identity={identity}/>)},
  {path:'/commerce-report',label:'Bản công bố',glyph:DatabaseGlyph,nav:()=>true,render:guard((user,identity)=><CommerceReportPage user={user} identity={identity}/>)},
  {path:'/decisions',label:'Quyết định',glyph:SettingsGlyph,nav:()=>true,render:guard((user,identity)=><DecisionsPage user={user} identity={identity}/>)},
  {path:'/admin',label:'Quản trị',glyph:SettingsGlyph,nav:({user})=>user?.role==='owner',render:guard((user,identity)=><AdminPage user={user} identity={identity}/>)}
 ]
};
const CustomerApp=createApp(config);
export default function App(){return <CustomerApp/>;}
