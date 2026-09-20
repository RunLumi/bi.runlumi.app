import {ApiError,type Tenant} from './api';
import type {CommerceReport} from '../../../../packages/core/commerce-report.ts';
import type {CommerceFinding} from '../../../../packages/core/commerce-insights.ts';
export type {CommerceReport,CommerceFinding};
export const commercePermitted=(tenant:Tenant)=>tenant.role==='owner'&&tenant.features.includes('data.import');
export interface CommercePublication {activePublicationId:string|null;revision:number;noPublishedData:boolean;publication:null|{id:string;contentHash:string;publishedAt:string;report:CommerceReport};health?:{pendingOrQuarantined:{id:string;state:string}[];truncated:boolean}}
export interface CommerceCapability {capabilityId:string;state:string;evidenceRef:string;testedAt:string;coverage:Record<string,unknown>;revision:number}
export interface CommerceCapabilityConnection {connectionId:string;provider:string;sourceAccountId:string;resourceType:string;connectionState:string;capabilities:CommerceCapability[]}
export interface CommerceConnection {id:string;provider:string;sourceAccountId:string;resourceType:'orders'|'inventory'|'settlements';state:string;revision:number}
export interface CommerceBuild {normalizationId:string;receiptId:string;state:string;reasonCode:string|null;recordCount:number;contentHash:string;createdAt:string}
export interface CommerceReceipt {receiptId:string;state:string;connectionId:string;normalizedRevision:string|null;publishedVersion:string|null}
export interface CommerceDecision {id:string;publication_id:string;finding:CommerceFinding;rationale:string;owner_subject:string;due_on:string|null;state:'OPEN'|'INVESTIGATING'|'AWAITING_OUTCOME'|'RESOLVED'|'ACCEPTED_LIMITATION';revision:number;outcome_note:string|null}
export interface Candidate {normalizationIds:string[];mappingId:string|null;controls:unknown[];expectedRevision:number;expectedPublicationId:string|null}
export interface Preview {publicationId:string;previewHash:string;report:CommerceReport;expectedRevision:number;published:false}
/** Do not coerce financial strings through Number/parseFloat in the UI. */
export function exactNumber(value:string|number|null|undefined):string {
 if(value===null||value===undefined)return 'Chưa đủ dữ liệu';
 const s=String(value);if(!/^-?\d+(\.\d+)?$/.test(s))return s;
 const negative=s.startsWith('-'),[whole,fraction]=(negative?s.slice(1):s).split('.');
 return (negative?'−':'')+whole!.replace(/\B(?=(\d{3})+(?!\d))/g,'.')+(fraction?','+fraction.replace(/0+$/,''):'').replace(/,$/,'');
}
export function localInstant(value:string):string {
 return new Intl.DateTimeFormat('vi-VN',{dateStyle:'short',timeStyle:'short',timeZone:'Asia/Ho_Chi_Minh'}).format(new Date(value));
}
export const commerceLabels:Record<string,string>={
 SOURCE_COMPLETENESS_UNVERIFIED:'Chưa chứng nhận độ đầy đủ nguồn',MERCHANT_CERTIFICATION_REQUIRED:'Cần người phụ trách xác nhận số liệu',MISSING_INDEPENDENT_CONTROLS:'Còn thiếu số kiểm soát độc lập',MISSING_HISTORICAL_COGS:'Thiếu giá vốn lịch sử',MISSING_VARIABLE_FEES:'Thiếu phí biến đổi',MISSING_EARNED_COMPONENTS:'Chưa rõ thu vận chuyển hoặc hỗ trợ',MISSING_AVAILABLE_STOCK:'Thiếu hàng khả dụng',NEGATIVE_STOCK:'Có tồn kho âm',ADVERTISED_STOCK_EXCLUDED:'Đã loại tồn phân bổ trên kênh',SOURCE_AUTHORITY_DIFFERENCE:'Nguồn có chênh lệch đã chọn theo ưu tiên',
 OPEN:'Mới ghi nhận',INVESTIGATING:'Đang kiểm tra',AWAITING_OUTCOME:'Chờ kết quả',RESOLVED:'Đã kiểm chứng kết quả',ACCEPTED_LIMITATION:'Chấp nhận giới hạn',
};
export async function downloadCommerce(path:string,identity:string,filename:string):Promise<void>{
 const response=await fetch(path,{headers:identity?{'x-demo-user':identity}:{},credentials:'same-origin',cache:'no-store'});
 if(!response.ok){const body=await response.json().catch(()=>({}));throw new ApiError(body.error?.code??'EXPORT_FAILED',response.status);}
 const url=URL.createObjectURL(await response.blob()),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
}
