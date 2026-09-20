import {createApp,type AppConfig,type AppPage,NavContext,PageContext} from '@runlumi/ui/app.tsx';
import {CommerceDataPage} from '@runlumi/ui/features/commerce-data.tsx';
import {CommerceReportPage} from '@runlumi/ui/features/commerce-report.tsx';
import {CommercePage} from '@runlumi/ui/features/commerce.tsx';
import {DashboardPage} from '@runlumi/ui/features/dashboard.tsx';
import {ConfigurationPage} from '@runlumi/ui/features/configuration.tsx';
import {Empty} from '@runlumi/ui/components/states.tsx';
import {DashboardGlyph,GitGlyph,DatabaseGlyph} from '@runlumi/ui/components/glyphs.tsx';
import {commercePermitted} from '@runlumi/ui/lib/commerce.ts';
import {manifest} from '../../../customer/manifest.ts';
import {customerPages} from '../../../customer/ui/pages.tsx';
import {applyBrandTokens} from '../../../customer/ui/theme.ts';

applyBrandTokens();

const needTenant=<Empty>Chọn doanh nghiệp được cấp quyền trước.</Empty>;
const commerceNav=(ctx:NavContext)=>!!ctx.tenant&&commercePermitted(ctx.tenant);
const commerceEnabled=manifest.modules.includes('commerce');
const operationsEnabled=manifest.modules.includes('operations');

const basePages:AppPage[]=[
 {path:'/',label:'Tổng quan',glyph:DashboardGlyph,nav:()=>true,
  render:({tenant,identity}:PageContext)=>tenant?<CommercePage tenant={tenant} identity={identity}/>:<Empty>Chưa có membership đang hiệu lực.</Empty>},
 ...(commerceEnabled?[
  {path:'/money',label:'Số liệu thương mại',glyph:DashboardGlyph,nav:commerceNav,
   render:({tenant,identity}:PageContext)=>tenant?<CommerceReportPage tenant={tenant} identity={identity}/>:needTenant},
  {path:'/commerce-data',label:'Nguồn & bản nhập',glyph:DatabaseGlyph,nav:commerceNav,
   render:({tenant,identity}:PageContext)=>tenant?<CommerceDataPage tenant={tenant} identity={identity}/>:needTenant}
 ] satisfies AppPage[]:[]),
 ...(operationsEnabled?[
  {path:'/operations',label:'Chi phí thao tác',glyph:DatabaseGlyph,nav:({tenant}:NavContext)=>!!tenant,
   render:({tenant,identity,demo}:PageContext)=>tenant?<DashboardPage tenant={tenant} identity={identity} demo={demo}/>:needTenant}
 ] satisfies AppPage[]:[]),
 {path:'/configuration',label:'Cấu hình Git & AI',glyph:GitGlyph,nav:({tenant}:NavContext)=>!!tenant,
  render:({tenant,identity}:PageContext)=>tenant?<ConfigurationPage tenant={tenant} identity={identity}/>:needTenant}
];

const config:AppConfig={
 brand:{name:manifest.displayName,logoSrc:manifest.brand.logoSrc,logoAlt:manifest.brand.logoAlt,workspaceLabel:'KHÔNG GIAN DỮ LIỆU',
  footer:<><DatabaseGlyph/><p>D1 riêng theo doanh nghiệp<br/><span>Một bộ định nghĩa dùng chung.</span></p></>},
 labels:{skipToContent:'Đến nội dung',tenantLabel:'Doanh nghiệp',tenantAriaLabel:'Doanh nghiệp',navAriaLabel:'Điều hướng',
  noTenantsOption:'Nhà vận hành nền tảng',operatorBar:'RunLumi / vận hành nền tảng',notFound:'Không tìm thấy trang.',
  demoNotice:'Dữ liệu minh họa · Không phải kết quả của khách hàng',demoIdentityAriaLabel:'Danh tính thử nghiệm'},
 demoIdentities:[],
 pages:[...basePages,...customerPages]
};

export default createApp(config);
