import {AppError,text} from './contracts.ts';
import {CORE_MODULES,type CoreModule} from './extension-contracts.ts';
export {CORE_MODULES,parseDecisionRules,type CoreModule,type DecisionRule} from './extension-contracts.ts';
/** Customer application configuration schema. This is the reviewed contract between
 * a customer repository and the shared core. Validation runs at generation, build and
 * startup: invalid identifiers, unknown modules, reserved-route collisions and
 * incompatible core versions fail closed before deployment. */
/** Routes and metric namespaces owned by the shared core. Customer content may not
 * silently replace these; an explicit new version is required to change meaning. */
export const RESERVED_ROUTES=['/','/money','/commerce-data','/operations','/configuration','/control'] as const;
export const RESERVED_METRIC_NAMESPACES=['lumi','commerce'] as const;
/** Non-secret customer identity and enabled modules. Shared by browser and worker. */
export interface CustomerManifest {
  customerId:string;
  displayName:string;
  locale:string;
  currency:string;
  timezone:string;
  modules:CoreModule[];
  extensions:{namespace:string;version:string}[];
  brand:{logoSrc:string;logoAlt:string};
}
export interface CustomerPageRoute {path:string;label:string}
/** Customer decision workflow. Records a supported, human-reviewed response to an
 * observed core finding. `externalAction` is always `false`: lumi-agents owns action
 * authority and verification; customer rules cannot execute side effects. */
const IDENT=/^[a-z0-9][a-z0-9-]{0,62}$/;
const NAMESPACE=/^[a-z][a-z0-9_]{0,31}$/;
const SEMVER=/^\d+\.\d+\.\d+$/;
function identifier(value:unknown,max:number,code:string):string{
 if(typeof value!=='string'||!value.trim()||value.length>max||!/^[\x20-\x7e]+$/.test(value)||/[\x00-\x1f]/.test(value))throw new AppError(422,code);
 return value;
}
/** Validate the manifest. `RESERVED_*` are constants here, not customer-supplied. */
export function parseCustomerManifest(value:unknown):CustomerManifest{
 if(!value||typeof value!=='object'||Array.isArray(value))throw new AppError(422,'INVALID_CUSTOMER_MANIFEST');
 const v=value as Record<string,unknown>;
 if(!IDENT.test(String(v.customerId))||/^0+$/.test(String(v.customerId).replaceAll('-','')))throw new AppError(422,'INVALID_CUSTOMER_ID');
 if(typeof v.displayName!=='string'||!v.displayName.trim()||v.displayName.length>120||/[\x00-\x1f]/.test(v.displayName))throw new AppError(422,'INVALID_DISPLAY_NAME');
 if(typeof v.locale!=='string'||!/^[a-z]{2}-[A-Z]{2}$/.test(v.locale))throw new AppError(422,'INVALID_LOCALE');
 if(typeof v.currency!=='string'||!/^[A-Z]{3}$/.test(v.currency))throw new AppError(422,'INVALID_CURRENCY');
 if(typeof v.timezone!=='string'||!v.timezone.includes('/')||v.timezone.length>64||/[\x00-\x1f]/.test(v.timezone))throw new AppError(422,'INVALID_TIMEZONE');
 if(!Array.isArray(v.modules)||!v.modules.length||new Set(v.modules).size!==v.modules.length||!v.modules.every(m=>CORE_MODULES.includes(m as CoreModule)))throw new AppError(422,'UNKNOWN_MODULE');
 if(!Array.isArray(v.extensions)||v.extensions.length>16)throw new AppError(422,'INVALID_EXTENSIONS');
 const seen=new Set<string>();
 const extensions=v.extensions.map(raw=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new AppError(422,'INVALID_EXTENSIONS');
  const e=raw as Record<string,unknown>;const namespace=String(e.namespace);
  if(!NAMESPACE.test(namespace)||seen.has(namespace))throw new AppError(422,'INVALID_EXTENSION_NAMESPACE');
  if(RESERVED_METRIC_NAMESPACES.includes(namespace as never))throw new AppError(422,'RESERVED_NAMESPACE');
  seen.add(namespace);
  if(typeof e.version!=='string'||!SEMVER.test(e.version))throw new AppError(422,'INVALID_EXTENSION_VERSION');
  return {namespace,version:e.version};
 });
 const brand=v.brand as Record<string,unknown>|undefined;
 if(!brand||typeof brand!=='object')throw new AppError(422,'INVALID_BRAND');
 return {
  customerId:String(v.customerId),
  displayName:String(v.displayName),
  locale:String(v.locale),currency:String(v.currency),timezone:String(v.timezone),
  modules:[...(v.modules as CoreModule[])],
  extensions,
  brand:{logoSrc:identifier(brand.logoSrc,200,'INVALID_BRAND_LOGO'),logoAlt:typeof brand.logoAlt==='string'?brand.logoAlt:''}
 };
}
/** Validate customer page routes against reserved core routes and each other. */
export function parseCustomerRoutes(value:unknown):CustomerPageRoute[]{
 if(!Array.isArray(value)||value.length>32)throw new AppError(422,'INVALID_CUSTOMER_ROUTES');
 const seen=new Set<string>();
 return value.map(raw=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new AppError(422,'INVALID_CUSTOMER_ROUTES');
  const r=raw as Record<string,unknown>;const routePath=String(r.path);
  if(!/^\/[a-z0-9][a-z0-9/-]{0,63}$/.test(routePath))throw new AppError(422,'INVALID_CUSTOMER_ROUTE');
  if((RESERVED_ROUTES as readonly string[]).includes(routePath))throw new AppError(409,'RESERVED_ROUTE');
  if(seen.has(routePath))throw new AppError(409,'DUPLICATE_CUSTOMER_ROUTE');
  seen.add(routePath);
  return {path:routePath,label:text(r.label,120)};
 });
}
/** Core/extension compatibility. A customer declares the core version it was built
 * against; the extension API major must match, and the core major must match. */
export function assertCompatible(customerCoreVersion:string,availableCoreVersion:string,requiredExtensionApi:number,availableExtensionApi:number):void{
 const parse=(v:string)=>{const m=/^(\d+)\.(\d+)\.(\d+)$/.exec(v);if(!m)throw new AppError(422,'INVALID_CORE_VERSION');return {major:Number(m[1]),minor:Number(m[2]),patch:Number(m[3])};};
 const want=parse(customerCoreVersion),have=parse(availableCoreVersion);
 if(want.major!==have.major)throw new AppError(409,'CORE_MAJOR_INCOMPATIBLE');
 if(requiredExtensionApi!==availableExtensionApi)throw new AppError(409,'EXTENSION_API_INCOMPATIBLE');
}
