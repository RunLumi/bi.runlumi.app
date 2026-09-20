import type {Dashboard} from '../../../../packages/core/semantics.ts';
export interface Tenant {id:string;name:string;role:'owner'|'editor'|'viewer';cell_id:string;features:string[];license:{plan:string;state:string;endsAt:string;revision:number}|null}
export interface Session {demo:boolean;tenants:Tenant[];platformOperator:boolean}
export interface SavedDashboard {id:string;revision:number;management:'git'|'ui';releaseId?:string;definition:Dashboard}
export interface Metric {id:string;label:string;unit:string;definition:string}
export interface QueryResult {data:Record<string,number|string>[];meta:{tenantId:string;configurationRelease:string;noPublishedData:boolean;provenance:{id:string;content_hash:string;observed_through:string}[]}}
export interface Configuration {active:null|{name:string;releaseId:string;revision:number;sourceCommit:string;queries:{id:string}[];ai:{enabled:boolean;providerInstanceRef:string;modelRef:string;dailyBudgetUsd:number;inferenceImplemented:false}}}
export interface Overview {tenants:{id:string;name:string;cell_id:string;state:string;plan_id:string|null;license_state:string|null;active_release_id:string|null;config_revision:number}[];users:{issuer:string;subject:string;state:string;tenant_count:number}[];limit:number}
export class ApiError extends Error{constructor(public code:string,public status:number){super(code);}}
export async function api<T>(path:string,identity:string,options:{body?:unknown;method?:string;revision?:number;signal?:AbortSignal}={}):Promise<T>{
 const headers:Record<string,string>={};if(identity)headers['x-demo-user']=identity;
 if(options.body!==undefined)headers['content-type']='application/json';if(options.revision!==undefined)headers['if-match']=`"${options.revision}"`;
 const response=await fetch(path,{method:options.method??'GET',headers,credentials:'same-origin',cache:'no-store',signal:options.signal,...(options.body!==undefined?{body:JSON.stringify(options.body)}:{})});
 if(!response.ok){let code='REQUEST_FAILED';try{code=(await response.json()).error?.code??code;}catch{}throw new ApiError(code,response.status);}
 return response.json() as Promise<T>;
}
export function message(error:unknown):string{
 const code=error instanceof ApiError?error.code:'';
 const messages:Record<string,string>={ENTITLEMENT_REQUIRED:'Gói sử dụng chưa cấp tính năng này hoặc đã hết hạn.',TENANT_ACCESS_DENIED:'Bạn không có quyền truy cập doanh nghiệp này.',PLATFORM_OPERATOR_REQUIRED:'Chỉ người vận hành được cấp quyền mới xem được Control Plane.',GIT_MANAGED_DASHBOARD:'Dashboard này được quản lý bằng Git. Hãy tạo pull request hoặc tạo bản sao.',REVISION_CONFLICT:'Cấu hình đã thay đổi. Tải lại trước khi lưu.',MIXED_SNAPSHOT:'Dữ liệu hoặc cấu hình vừa thay đổi. Hãy tải lại để xem cùng một phiên bản.',CONTROL_UNAVAILABLE:'Dịch vụ cấp quyền chưa sẵn sàng. Không mở dữ liệu khi chưa xác minh được quyền.'};
 return messages[code]??'Chưa tải được dữ liệu. Hãy thử lại hoặc liên hệ người quản trị.';
}
export async function dashboardData(tenant:string,identity:string,dashboard:SavedDashboard,from:string,to:string,signal:AbortSignal){
 const results=await Promise.all(dashboard.definition.widgets.map(w=>api<QueryResult>(`/api/tenants/${tenant}/query`,identity,{method:'POST',body:{metrics:w.metrics,groupBy:w.groupBy,from,to},signal})));
 const fingerprint=(r:QueryResult)=>JSON.stringify([r.meta.configurationRelease,r.meta.provenance.map(p=>[p.id,p.content_hash])]);
 if(results.some(r=>r.meta.tenantId!==tenant||fingerprint(r)!==fingerprint(results[0]!)||(dashboard.releaseId&&r.meta.configurationRelease!==dashboard.releaseId)))throw new ApiError('MIXED_SNAPSHOT',409);
 return results;
}
