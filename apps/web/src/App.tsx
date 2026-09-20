import {Navigate} from 'react-router-dom';
import {createApp,type AppConfig} from '@runlumi/ui/app.tsx';
import {CommerceDataPage} from '@runlumi/ui/features/commerce-data.tsx';
import {CommerceReportPage} from '@runlumi/ui/features/commerce-report.tsx';
import {commercePermitted} from '@runlumi/ui/lib/commerce.ts';
import {CommercePage} from '@runlumi/ui/features/commerce.tsx';
import {api,type Session} from '@runlumi/ui/lib/api.ts';
import {DashboardPage} from '@runlumi/ui/features/dashboard.tsx';
import {ConfigurationPage} from '@runlumi/ui/features/configuration.tsx';
import {ControlPage} from '@runlumi/ui/features/control.tsx';
import {Empty} from '@runlumi/ui/components/states.tsx';
import {DashboardGlyph,GitGlyph,SettingsGlyph,DatabaseGlyph} from '@runlumi/ui/components/glyphs.tsx';
import type {Tenant} from '@runlumi/ui/lib/api.ts';

const needTenant=<Empty>Chọn doanh nghiệp được cấp quyền trước.</Empty>;
const config:AppConfig={
 brand:{name:<>Lumi <span>BI</span></>,logoSrc:'/brand/lumi-logo.svg',logoAlt:'',workspaceLabel:'KHÔNG GIAN DỮ LIỆU',
  footer:<><DatabaseGlyph/><p>D1 riêng theo tenant<br/><span>Một bộ định nghĩa dùng chung.</span></p></>},
 labels:{skipToContent:'Đến nội dung',tenantLabel:'Doanh nghiệp',tenantAriaLabel:'Doanh nghiệp',navAriaLabel:'Điều hướng',
  noTenantsOption:'Platform operator',operatorBar:'RunLumi / platform operations',notFound:'Không tìm thấy trang.',
  demoNotice:'Dữ liệu minh họa · Không phải kết quả của khách hàng',demoIdentityAriaLabel:'Danh tính thử nghiệm'},
 demoIdentities:['alpha-owner','alpha-editor','alpha-viewer','beta-owner','beta-viewer','platform-admin'],
 pages:[
  {path:'/',label:'Tổng quan',glyph:DashboardGlyph,nav:()=>true,
   render:({tenant,identity,session})=>tenant?<CommercePage tenant={tenant} identity={identity}/>:session.platformOperator?<Navigate to="/control" replace/>:<Empty>Chưa có membership đang hiệu lực.</Empty>},
  {path:'/money',label:'Số liệu thương mại',glyph:DashboardGlyph,nav:({tenant})=>!!tenant&&commercePermitted(tenant),
   render:({tenant,identity})=>tenant?<CommerceReportPage tenant={tenant} identity={identity}/>:needTenant},
  {path:'/commerce-data',label:'Nguồn & bản nhập',glyph:DatabaseGlyph,nav:({tenant})=>!!tenant&&commercePermitted(tenant),
   render:({tenant,identity})=>tenant?<CommerceDataPage tenant={tenant} identity={identity}/>:needTenant},
  {path:'/operations',label:'Chi phí thao tác',glyph:DatabaseGlyph,nav:({tenant})=>!!tenant,
   render:({tenant,identity,demo})=>tenant?<DashboardPage tenant={tenant} identity={identity} demo={demo}/>:needTenant},
  {path:'/configuration',label:'Cấu hình Git & AI',glyph:GitGlyph,nav:({tenant})=>!!tenant,
   render:({tenant,identity})=>tenant?<ConfigurationPage tenant={tenant} identity={identity}/>:needTenant},
  {path:'/control',label:'Control Plane',glyph:SettingsGlyph,nav:({platformOperator})=>platformOperator,
   render:({identity})=><ControlPage identity={identity}/>}
 ]
};
// Session API surface is re-exported for composition-level typing only.
export type {Session,Tenant};
const CustomerApp=createApp(config);
export default function App(){return <CustomerApp/>;}
