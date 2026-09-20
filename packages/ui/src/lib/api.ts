import type {Dashboard} from '@runlumi/core/semantics.ts';
export interface Tenant {id:string;name:string;role:'owner'|'editor'|'viewer';cell_id:string;features:string[];license:{plan:string;state:string;endsAt:string;revision:number}|null}
export interface Session {demo:boolean;tenants:Tenant[];platformOperator:boolean}
export interface SavedDashboard {id:string;revision:number;management:'git'|'ui';configurationRelease:string;configurationRevision:number;releaseId?:string;definition:Dashboard}
export interface Metric {id:string;label:string;unit:string;definition:string}
export interface QueryResult {data:Record<string,number|string|null>[];meta:{tenantId:string;configurationRelease:string;configurationRevision:number;contextHash:string;qualityState:string;missingSources:string[];noPublishedData:boolean;provenance:{id:string;content_hash:string;observed_through:string}[]}}
export interface Configuration {active:null|{name:string;releaseId:string;revision:number;sourceCommit:string;provenance:'operator-asserted';attestationVerified:false;queries:{id:string}[];ai:{enabled:boolean;providerInstanceRef:string;modelRef:string;dailyBudgetUsd:number;inferenceImplemented:false}}}
export interface Overview {tenants:{id:string;name:string;cell_id:string;state:string;plan_id:string|null;license_state:string|null;active_release_id:string|null;config_revision:number}[];users:{issuer:string;subject:string;state:string;tenant_count:number}[];limit:number}
export class ApiError extends Error{constructor(public code:string,public status:number){super(code);}}
export async function api<T>(path:string,identity:string,options:{body?:unknown;method?:string;revision?:number;signal?:AbortSignal}={}):Promise<T>{
 const headers:Record<string,string>={};if(identity)headers['x-demo-user']=identity;
 if(options.body!==undefined)headers['content-type']='application/json';if(options.revision!==undefined)headers['if-match']=`"${options.revision}"`;
 const response=await fetch(path,{method:options.method??'GET',headers,credentials:'same-origin',cache:'no-store',...(options.signal?{signal:options.signal}:{}),...(options.body!==undefined?{body:JSON.stringify(options.body)}:{})});
 if(!response.ok){let code='REQUEST_FAILED';try{code=(await response.json()).error?.code??code;}catch{}throw new ApiError(code,response.status);}
 return response.json() as Promise<T>;
}
export function message(error:unknown):string{
 const code=error instanceof ApiError?error.code:'';
 const messages:Record<string,string>={
  INVALID_JSON:'Tệp hoặc phần khai báo chưa phải JSON hợp lệ.',RAW_EXPORT_LIMIT:'Mỗi bản xuất hiện hỗ trợ tối đa 48 KB và 100 bản ghi. Không chia nhỏ tùy tiện rồi cộng các ảnh chụp nguồn.',OWNER_REQUIRED:'Tính năng này cần quyền chủ doanh nghiệp.',
  CROSS_SOURCE_IDENTITY_REVIEW_REQUIRED:'Có nhiều nguồn cùng loại. Cần duyệt liên kết danh tính cho từng đối tượng trước khi cộng số.',OVERLAPPING_SOURCE_SNAPSHOTS:'Không chọn hai bản chụp của cùng tài khoản và loại dữ liệu trong một lần công bố.',
  INDEPENDENT_CONTROL_MISMATCH:'Bản nhập không khớp số kiểm soát đã khai báo. Đối chiếu nguồn trước khi công bố.',PUBLICATION_WINDOW_MISMATCH:'Các nguồn được chọn không cùng kỳ báo cáo.',PUBLICATION_PREVIEW_REQUIRED:'Cần tính lại và duyệt đúng bản xem trước.',PUBLICATION_REVISION_CONFLICT:'Đã có bản khác được công bố. Tính lại bản xem trước trên phiên bản mới.',
  SOURCE_OBSERVATION_REGRESSION:'Không dùng bản quan sát cũ hơn, hoặc đổi dữ liệu mà giữ nguyên mốc quan sát.',PUBLICATION_SOURCE_OMISSION:'Bản mới không được âm thầm bỏ một nguồn đã có. Cần sửa đầy đủ phạm vi trước.',
  PUBLICATION_SOURCE_REVOKED:'Một nguồn đã dừng, bị thu hồi hoặc đổi quyền. Không mở lại số đã lưu khi chưa đủ quyền.',NORMALIZATION_SCOPE_CHANGED:'Nguồn hoặc bản chuẩn hóa đã đổi quyền. Kiểm tra trước khi công bố.',
  SOURCE_SCOPE_MISMATCH:'Tài khoản hoặc loại dữ liệu trong tệp không khớp nguồn được chọn.',CONNECTION_EXISTS_OR_QUOTA:'Mã kết nối đã tồn tại hoặc đã đạt giới hạn. Chọn nguồn đang có hoặc một mã mới.',
  CONNECTION_REVISION_OR_STATE_CONFLICT:'Quyền nguồn đã thay đổi hoặc kết nối đã thu hồi. Tải lại trạng thái.',DELIVERY_ID_CONFLICT:'Mã lần gửi đã dùng cho nội dung khác. Giữ mã cũ khi gửi lại nguyên tệp; dùng mã mới cho bản mới.',
  OUTCOME_NOT_OBSERVED:'Chưa đủ bằng chứng kết quả: cần bản mới cùng phạm vi, còn đối tượng và điều kiện đã hết.',NEW_OUTCOME_EVIDENCE_REQUIRED:'Cần một bản công bố mới để xác nhận kết quả.',RECURRENCE_REVIEW_REQUIRED:'Điều kiện này thuộc một việc đã đóng. Cần xem lại lần tái diễn, không đánh dấu đã xử lý tự động.',
  DECISION_REQUIRES_CURRENT_EVIDENCE:'Bản bằng chứng đã được thay thế. Mở bản hiện tại trước khi ghi nhận việc.',
CONFIGURATION_CHANGED:'Cấu hình vừa đổi. Tải lại danh sách dashboard trước khi xem dữ liệu.',TENANT_ROUTE_FENCED:'Dữ liệu đang chuyển môi trường. Tạm dừng truy cập để kiểm tra định tuyến.',PACK_METRIC_DENIED:'Bản cấu hình hiện tại không cho phép chỉ số được yêu cầu.',ENTITLEMENT_REQUIRED:'Gói sử dụng chưa cấp tính năng này hoặc đã hết hạn.',TENANT_ACCESS_DENIED:'Bạn không có quyền truy cập doanh nghiệp này.',PLATFORM_OPERATOR_REQUIRED:'Chỉ người vận hành được cấp quyền mới xem được Control Plane.',GIT_MANAGED_DASHBOARD:'Dashboard này được quản lý bằng Git. Hãy tạo pull request hoặc tạo bản sao.',REVISION_CONFLICT:'Cấu hình đã thay đổi. Tải lại trước khi lưu.',MIXED_SNAPSHOT:'Dữ liệu hoặc cấu hình vừa thay đổi. Hãy tải lại để xem cùng một phiên bản.',CONTROL_UNAVAILABLE:'Dịch vụ cấp quyền chưa sẵn sàng. Không mở dữ liệu khi chưa xác minh được quyền.'};
 return messages[code]??'Chưa tải được dữ liệu. Hãy thử lại hoặc liên hệ người quản trị.';
}
export async function dashboardData(tenant:string,identity:string,dashboard:SavedDashboard,from:string,to:string,signal:AbortSignal){
 const batch=await api<{contextHash:string;results:QueryResult[]}>(`/api/tenants/${tenant}/query-batch`,identity,{method:'POST',signal,body:{
   configurationRelease:dashboard.configurationRelease,configurationRevision:dashboard.configurationRevision,
   queries:dashboard.definition.widgets.map(w=>({metrics:w.metrics,groupBy:w.groupBy,from,to}))
 }});
 if(batch.results.length!==dashboard.definition.widgets.length || batch.results.some(r=>r.meta.tenantId!==tenant||r.meta.contextHash!==batch.contextHash||r.meta.configurationRelease!==dashboard.configurationRelease||r.meta.configurationRevision!==dashboard.configurationRevision))throw new ApiError('MIXED_SNAPSHOT',409);
 return batch.results;
}
