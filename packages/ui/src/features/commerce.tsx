import {useQuery} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {commercePermitted,type CommercePublication} from '../lib/commerce.ts';
import {api,type Tenant} from '../lib/api.ts';
import {Card,CardHeader,CardTitle,CardContent} from '../components/ui/card.tsx';
import {Loading,ErrorState} from '../components/states.tsx';
import type {commerceReadiness} from '@runlumi/core/commerce-readiness.ts';

export function CommercePage({tenant,identity}:{tenant:Tenant;identity:string}) {
  const query=useQuery({queryKey:['readiness',identity,tenant.id],queryFn:({signal})=>api<typeof commerceReadiness>(`/api/tenants/${tenant.id}/readiness`,identity,{signal})});
  const publication=useQuery({queryKey:['commerce-report',identity,tenant.id],enabled:commercePermitted(tenant),queryFn:({signal})=>api<CommercePublication>(`/api/tenants/${tenant.id}/commerce-publications`,identity,{signal})});
  if(query.isPending)return <Loading/>;
  if(query.isError)return <ErrorState error={query.error} retry={()=>query.refetch()}/>;
  const readiness=query.data;
  return <>
    <div className="page-title"><div><p className="eyebrow">COMMERCE INTELLIGENCE</p><h1>Tiền rõ. Hàng đúng. Việc không sót.</h1><p>Một nơi để biết điều gì cần chú ý, và kiểm tra được bằng chứng phía sau.</p></div><span className="tag">Giai đoạn nền tảng</span></div>
    {publication.isError?<ErrorState error={publication.error}/>:publication.data?.publication?<div className="notice readiness-note"><strong>Đã có bản thương mại được duyệt trong phạm vi bản xuất.</strong><p>Số tạm tính có truy vết. Chưa chứng nhận độ đầy đủ nguồn hoặc API trực tiếp.</p><Link className="inline-link" to="/money">Mở bản công bố →</Link></div>:<div className="notice readiness-note"><strong>Chưa kết nối dữ liệu thương mại thực tế.</strong><p>Không hiển thị số doanh thu, lợi nhuận hay tồn kho giả định. Có thể nhập một phạm vi bản xuất được cho phép, kiểm tra rồi duyệt công bố số tạm tính.</p></div>}
    {commercePermitted(tenant)&&<Link className="inline-link" to="/commerce-data">Bắt đầu từ bản xuất có kiểm soát →</Link>}
    <div className="commerce-grid">{readiness.products.map(product=><Card key={product.id}><CardHeader><p className="eyebrow">{product.state==='PARTIAL'?'NỀN TẢNG MỘT PHẦN':'CHƯA TRIỂN KHAI'}</p><CardTitle>{product.name}</CardTitle></CardHeader><CardContent><p className="product-question">{product.question}</p><ul className="requirements">{product.missing.map(item=><li key={item}>{item}</li>)}</ul>{product.id==='operations-exceptions'&&<Link className="inline-link" to="/operations">Xem dashboard chi phí thao tác →</Link>}</CardContent></Card>)}</div>
    <Card className="mt-6"><CardHeader><CardTitle>Nguồn cần kết nối</CardTitle></CardHeader><CardContent><div className="connector-list">{readiness.connectors.map(source=><div key={source.id}><strong>{source.name}</strong><span>{source.state==='ACCESS_NOT_VERIFIED'?'Cần xác minh quyền API':'Chưa có kết nối trực tiếp'}</span></div>)}</div><p className="muted">Đây là trạng thái năng lực của bản phát hành, không phải kết quả kiểm tra tài khoản hoặc quyền API của bạn.</p></CardContent></Card>
    <div className="config-grid mt-6"><Card><CardHeader><CardTitle>Bước xác minh đầu tiên</CardTitle></CardHeader><CardContent><p>{readiness.nextEvidence}</p><p className="muted">Bắt đầu từ số liệu có thể đối chiếu. Chỉ mở rộng sau khi người phụ trách xác nhận định nghĩa và phạm vi.</p></CardContent></Card><Card><CardHeader><CardTitle>Ask Lumi · chưa bật</CardTitle></CardHeader><CardContent><p>AI sẽ giải thích các chỉ số được cấp quyền, không tự tạo công thức hoặc tự gửi lệnh.</p><p className="muted">Chưa có suy luận LLM, chatbot hay hành động tự động trong bản này.</p><Link className="inline-link" to="/configuration">Xem cấu hình Git & AI →</Link></CardContent></Card></div>
  </>;
}
