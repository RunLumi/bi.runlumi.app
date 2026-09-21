import {createApp,type AppConfig} from '@runlumi/ui/app.tsx';
import {DashboardPage} from '@runlumi/ui/features/dashboard.tsx';
import {DashboardGlyph,DatabaseGlyph} from '@runlumi/ui/components/glyphs.tsx';
import type {InstallationUser} from '@runlumi/ui/lib/api.ts';

const renderDashboard=({user,identity,demo}:{user:InstallationUser|null;identity:string;demo:boolean})=>user?<DashboardPage user={user} identity={identity} demo={demo}/>:<main className="state">Chưa có người dùng đăng nhập.</main>;
const config:AppConfig={
 brand:{name:<>Lumi <span>BI</span></>,logoSrc:'/brand/lumi-logo.svg',logoAlt:'',workspaceLabel:'KHÔNG GIAN DỮ LIỆU',footer:<><DatabaseGlyph/><p>Dữ liệu thuộc installation này<br/><span>Không có user selector.</span></p></>},
 labels:{skipToContent:'Đến nội dung',installationLabel:'Installation',installationAriaLabel:'Installation',navAriaLabel:'Điều hướng',noUsersOption:'Chưa đăng nhập',operatorBar:'Installation',notFound:'Không tìm thấy trang.',demoNotice:'Dữ liệu minh họa · Không phải kết quả của khách hàng',demoIdentityAriaLabel:'Danh tính thử nghiệm'},
 demoIdentities:['local-owner','local-editor','local-viewer'],
 pages:[
  {path:'/',label:'Tổng quan',glyph:DashboardGlyph,nav:()=>true,render:renderDashboard},
  {path:'/operations',label:'Chi phí thao tác',glyph:DatabaseGlyph,nav:({user})=>!!user,render:renderDashboard}
 ]
};
const CustomerApp=createApp(config);
export default function App(){return <CustomerApp/>;}
