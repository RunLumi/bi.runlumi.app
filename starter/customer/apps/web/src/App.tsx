import {createApp,type AppConfig} from '@runlumi/ui/app.tsx';
import {DashboardPage} from '@runlumi/ui/features/dashboard.tsx';
import {DashboardGlyph} from '@runlumi/ui/components/glyphs.tsx';
import type {InstallationUser} from '@runlumi/ui/lib/api.ts';
const config:AppConfig={brand:{name:'__DISPLAY_NAME__',logoSrc:'/brand/customer-logo.svg',logoAlt:'',workspaceLabel:'INSTALLATION',footer:null},labels:{skipToContent:'Skip to content',installationLabel:'Installation',installationAriaLabel:'Installation',navAriaLabel:'Navigation',noUsersOption:'Not signed in',operatorBar:'Installation',notFound:'Not found',demoNotice:'Synthetic data',demoIdentityAriaLabel:'Demo identity'},demoIdentities:['local-owner'],pages:[{path:'/',label:'Overview',glyph:DashboardGlyph,nav:()=>true,render:({user,identity,demo})=>user?<DashboardPage user={user as InstallationUser} identity={identity} demo={demo}/>:null}]};
export default createApp(config);
