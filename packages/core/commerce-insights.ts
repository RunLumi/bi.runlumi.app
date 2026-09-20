import {orderMetrics,quantityUnits,sumMinor} from './commerce-model.ts';
import type {CommerceReport} from './commerce-report.ts';
export const DETECTOR_VERSION='commerce-observed-rules-v1';
export interface CommerceFinding {id:string;rule:string;entityId:string;entityType:'order'|'settlement'|'inventory';metricId:string;value:string|null;title:string;explanation:string;evidenceLimit:string;nextStep:string}
/** Observed conditions only. No missing-history sales-collapse/forecast/causal claims. */
export function commerceFindings(report:CommerceReport):CommerceFinding[]{
 const result:CommerceFinding[]=[];
 const add=(rule:string,entityType:CommerceFinding['entityType'],entityId:string,metricId:string,value:string|null,title:string,explanation:string,nextStep:string)=>result.push({id:`${rule}:${entityId}`,rule,entityType,entityId,metricId,value,title,explanation,nextStep,evidenceLimit:'Phạm vi bản nhập đã công bố; chưa chứng nhận đầy đủ nguồn hoặc nguyên nhân.'});
 for(const o of report.orders){
  if(o.recognizedAt===null)continue;
  if(o.cogs===null)add('missing-cogs','order',o.canonicalId,'cogs',null,'Thiếu giá vốn tại thời điểm bán','Chưa đủ cơ sở để tính lợi nhuận của đơn.','Đối chiếu và bổ sung chứng từ giá vốn lịch sử.');
  else if(o.variableFees===null)add('missing-fees','order',o.canonicalId,'contribution_pre_ads',null,'Chưa đủ phí biến đổi','Có giá vốn nhưng chưa đủ phí để tính phần đóng góp.','Nhập bảng phí tương ứng với đơn và kỳ đối soát.');
  else if(o.shippingIncome===null||o.earnedSubsidy===null)add('missing-income','order',o.canonicalId,'contribution_pre_ads',null,'Chưa rõ khoản thu được hưởng','Chưa đủ thông tin về thu vận chuyển hoặc hỗ trợ đã được hưởng.','Xác nhận từng khoản theo chính sách, không dùng số 0 cho khoản chưa rõ.');
  else {const value=orderMetrics([o]).contribution_pre_ads!;if(BigInt(value)<0n)add('negative-contribution','order',o.canonicalId,'contribution_pre_ads',value,'Đơn có phần đóng góp âm','Số bán sau giảm trừ thấp hơn giá vốn và phí đã ghi nhận.','Kiểm tra giảm giá, hoàn tiền, giá vốn và phí; chưa kết luận nguyên nhân.');}
 }
 for(const s of report.settlements){
  if(s.finality!=='final')continue;
  const gap=(BigInt(sumMinor(s.components.map(c=>c.amount)))-BigInt(sumMinor(s.receipts.map(r=>r.amount)))).toString();
  if(gap!=='0')add('payout-gap','settlement',s.canonicalId,'unreconciled_payout_amount',gap,'Khoản đối soát còn chênh lệch','Chênh lệch giữa bảng đã chốt và chứng từ tiền được gắn; không phải tiền đã thu hồi.','Kiểm tra thời điểm chuyển tiền, mã tham chiếu và chứng từ còn thiếu.');
 }
 for(const s of report.inventory){
  if(s.available===null)add('missing-stock','inventory',s.canonicalId,'available_units',null,'Chưa rõ số hàng khả dụng','Nguồn chưa cung cấp số khả dụng; không thay bằng 0.','Kiểm tra phạm vi kho và định nghĩa khả dụng của nguồn.');
  else if(quantityUnits(s.available)<=0n)add('nonpositive-stock','inventory',s.canonicalId,'available_units',s.available,'Số hàng khả dụng không dương','Đây là quan sát tồn kho, chưa đủ để suy ra nhu cầu hoặc số lượng cần mua.','Kiểm tra độ mới, giữ hàng và đơn nhập trước khi quyết định bổ sung.');
 }
 return result.sort((a,b)=>a.id<b.id?-1:1);
}
export function hasFindingEntity(report:CommerceReport,finding:CommerceFinding):boolean {
 const rows=finding.entityType==='order'?report.orders:finding.entityType==='settlement'?report.settlements:report.inventory;
 return rows.some(r=>r.canonicalId===finding.entityId);
}
/** Known numeric cells remain numeric; untrusted text cannot start a spreadsheet formula. */
export function csvCell(value:string,numeric=false):string {
 const safe=numeric&&/^-?\d+(?:\.\d+)?$/.test(value)?value:/^[\s\u0000-\u001f]*[=+\-@]/.test(value)||/^[\t\r\n]/.test(value)?"'"+value:value;
 return '"'+safe.replace(/"/g,'""')+'"';
}
export function commerceSummaryCsv(report:CommerceReport,publicationId:string,hash:string):string {
 const lines=[['metric_id','value','unit','publication_id','content_hash','semantic_version','quality','source_window_from','source_window_to_exclusive']];
 for(const [key,value] of Object.entries(report.metrics))lines.push([key,value===null?'':String(value),key==='available_units'?'units':key==='recognized_order_count'||key==='missingCogs'||key==='missingFees'||key==='missingIncome'||key==='physical_pool_variant_count'||key==='provisionalStatements'?'count':report.currency,publicationId,hash,report.semanticVersion,report.qualityState,report.window.from,report.window.toExclusive]);
 return '\ufeff'+lines.map((row,i)=>row.map((v,j)=>csvCell(v,i>0&&j===1)).join(',')).join('\r\n')+'\r\n';
}

/** Absence of an alert is not evidence of resolution. Require a known, comparable
 * observation satisfying the positive predicate for the original condition. */
export function findingResolved(report:CommerceReport,finding:CommerceFinding):boolean {
 if(finding.entityType==='order'){
  const o=report.orders.find(r=>r.canonicalId===finding.entityId);if(!o||o.recognizedAt===null)return false;
  if(finding.rule==='missing-cogs')return o.cogs!==null&&o.cogsEvidenceRef!==null;
  if(finding.rule==='missing-fees')return o.variableFees!==null;
  if(finding.rule==='missing-income')return o.shippingIncome!==null&&o.earnedSubsidy!==null;
  if(finding.rule==='negative-contribution'){const amount=orderMetrics([o]).contribution_pre_ads;return amount!==null&&BigInt(amount)>=0n;}
 }
 if(finding.entityType==='settlement'&&finding.rule==='payout-gap'){
  const s=report.settlements.find(r=>r.canonicalId===finding.entityId);return !!s&&s.finality==='final'&&sumMinor(s.components.map(c=>c.amount))===sumMinor(s.receipts.map(c=>c.amount));
 }
 if(finding.entityType==='inventory'){
  const s=report.inventory.find(r=>r.canonicalId===finding.entityId);if(!s||s.available===null)return false;
  if(finding.rule==='missing-stock')return true;
  if(finding.rule==='nonpositive-stock')return quantityUnits(s.available)>0n;
 }
 return false;
}
