import {AppError,text} from './contracts.ts';
import {parseCommerceQuery,queryCommerceReport} from './commerce-query.ts';
import {readCommerceQueryPublication} from './commerce-publication.ts';
import type {InstallationUser} from './installation-auth.ts';
import type {Database} from './ports.ts';

/** Curated, deterministic question path. No model or arbitrary SQL is involved. */
export async function answerCommerceQuestion(db:Database,actor:InstallationUser,input:unknown){
 const question=text((input as Record<string,unknown>)?.question,500),normalized=question.toLocaleLowerCase('vi-VN');
 if(/lãi|lợi nhuận|profit|đóng góp/.test(normalized))return {status:'INSUFFICIENT_DATA',interpretation:'Không tự đổi doanh số thành lợi nhuận; cần dữ liệu giá vốn/phí phù hợp.',limitations:['Câu hỏi lợi nhuận cần phạm vi chi phí được xác nhận.'],suggestedNextSteps:['Bổ sung giá vốn lịch sử và phí biến đổi trong bản nguồn đã duyệt.']};
 const metric=/(đơn|order)/.test(normalized)?'recognized_order_count':/(doanh|bán|sales|revenue)/.test(normalized)?'net_merchandise_sales':null;
 if(!metric)return {status:'NEEDS_CLARIFICATION',interpretation:null,limitations:['Chỉ hỗ trợ câu hỏi doanh số hàng hóa và số đơn trong curated path.'],suggestedNextSteps:['Nêu rõ doanh số hàng hóa hoặc số đơn, cùng bản công bố cần xem.']};
 if(/so với|so sánh|tháng trước|tuần trước/.test(normalized))return {status:'NEEDS_CLARIFICATION',interpretation:null,limitations:['Khoảng so sánh phải là ngày cụ thể để kết quả tái lập.'],suggestedNextSteps:['Cung cấp from/to của kỳ hiện tại và kỳ so sánh.']};
 const publication=await readCommerceQueryPublication(db,text((input as Record<string,unknown>).dataVersion,128));const query=parseCommerceQuery({contract:'lumi.query.v1',metrics:[{id:metric,version:1}],dimensions:[],filters:[],limit:1,consistency:'published',dataVersion:publication.id});const result=queryCommerceReport(publication.report as unknown as Record<string,unknown>,query);return {status:'ANSWERED',interpretation:metric==='net_merchandise_sales'?'Doanh số hàng hóa thuần':'Số đơn được ghi nhận',claims:[{metricId:metric,value:(result as Record<string,unknown>)[metric],publicationId:publication.id,contentHash:publication.contentHash}],semanticPlan:{metric,version:1,dataVersion:publication.id},limitations:publication.report.warnings,suggestedNextSteps:['Kiểm tra nguồn và phạm vi trước khi lưu hoặc tạo quyết định.']};
}
