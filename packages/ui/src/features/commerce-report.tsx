import {useQuery} from '@tanstack/react-query';
import {api,message,type InstallationUser,type CommercePublicationInfo} from '../lib/api.ts';
import {Card,CardHeader,CardTitle,CardContent} from '../components/ui/card.tsx';
import {Loading,Empty,ErrorState} from '../components/states.tsx';

const METRIC_LABELS:Record<string,string>= {
 net_merchandise_sales:'Doanh thu hàng hóa thuần',recognized_order_count:'Số đơn được ghi nhận',cogs:'Giá vốn hàng bán',gross_profit:'Lợi nhuận gộp',
 contribution_pre_ads:'Đóng góp trước quảng cáo',expected_settlement:'Khoản phải đối soát',observed_cash_received:'Tiền đã quan sát nhận',
 unreconciled_payout_amount:'Chênh lệch đối soát',recorded_recovery:'Tiền đã ghi nhận thu hồi',available_units:'Số lượng khả dụng',physical_pool_variant_count:'Số pool vật lý'};
const fmt=(value:string|null):string=>{
 if(value===null)return 'Chưa xác định';
 if(/^-?\d+$/.test(value))return new Intl.NumberFormat('vi-VN').format(BigInt(value));
 return value;
};

/** Published commerce evidence, rendered read-only from one pinned publication. */
export function CommerceReportPage({user,identity}:{user:InstallationUser;identity:string}){
 const publication=useQuery({queryKey:['publication',identity],queryFn:({signal})=>api<CommercePublicationInfo>('/api/commerce/publications',identity,{signal})});
 if(publication.isPending)return <Loading/>;
 if(publication.isError)return <ErrorState error={publication.error} retry={()=>publication.refetch()}/>;
 const data=publication.data;
 if(!data?.publication)return <Empty>Chưa có bản công bố nào. Hãy nhập và công bố dữ liệu commerce trước.</Empty>;
 const report=data.publication.report;
 return <div className="page-title"><div><p className="eyebrow">BÁO CÁO COMMERCE</p><h1>Bản công bố hiện hành</h1><p>Mọi số liệu đọc từ một bản công bố bất biến (v{data.revision}). Nguồn chưa được chứng nhận đầy đủ.</p></div>
 <div style={{display:'grid',gap:12}}>
  <div className="notice"><strong>{report.qualityState} · {report.semanticVersion}</strong><p>Kỳ dữ liệu {report.window.from.slice(0,10)} → {report.window.toExclusive.slice(0,10)}. Cảnh báo: {report.warnings.join(', ')}</p></div>
  <div className="dashboard-grid">
   {Object.entries(report.metrics).map(([id,value])=><Card key={id} className={id==='net_merchandise_sales'||id==='contribution_pre_ads'?'kpi-card':'wide-card'}><CardHeader><p className="eyebrow">{METRIC_LABELS[id]??id}</p><CardTitle>{fmt(value)}</CardTitle></CardHeader><CardContent><p className="metric-definition">{value===null?'Chưa đủ dữ liệu nguồn để tính chỉ số này; không thay bằng số 0.':id==='recorded_recovery'?'Chỉ tính khi có quyết định đã đóng kèm bằng chứng kết quả.':'Từ các đơn được ghi nhận trong kỳ của bản xuất đã công bố.'}</p></CardContent></Card>)}
  </div>
  <Card><CardHeader><CardTitle>Nguồn cấu thành</CardTitle></CardHeader><CardContent><div className="table-scroll"><table><thead><tr><th>Nhà cung cấp</th><th>Tài khoản</th><th>Loại</th><th>Quan sát đến</th><th>Số dòng</th></tr></thead><tbody>
   {report.sources.map(source=><tr key={source.normalizationId}><td>{source.provider}</td><td>{source.sourceAccountId}</td><td>{source.resourceType}</td><td>{source.observedAt.slice(0,19).replace('T',' ')}</td><td>{source.recordCount}</td></tr>)}
  </tbody></table></div>
  <details className="config-editor"><summary>Giới hạn đã công bố</summary><ul className="evidence-list">{report.limitations.map(limit=><li key={limit}>{limit}</li>)}</ul></details>
  <p className="metric-definition">Mã nội dung: <code>{data.publication.contentHash.slice(0,32)}…</code> · Xuất dữ liệu: <a href={`/api/commerce/publications/${data.publication.id}/export?format=csv`}>CSV</a> · <a href={`/api/commerce/publications/${data.publication.id}/export?format=json`}>JSON</a></p>
  </CardContent></Card>
 </div></div>;
}
