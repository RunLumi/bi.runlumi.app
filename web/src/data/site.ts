export const site = {
  name: 'Lumi BI',
  // The public landing page and authenticated platform are different surfaces.
  origin: 'https://about.bi.runlumi.app',
  appOrigin: 'https://bi.runlumi.app',
  email: 'hello@runlumi.app',
  title: 'Lumi BI — Thấy rõ kinh doanh. Biết việc cần làm.',
  description: 'Lumi BI: định hướng phân tích tiền, lợi nhuận, tồn kho và ngoại lệ vận hành cho doanh nghiệp thương mại Việt Nam. Khám phá bản minh họa và trao đổi về pilot.',
  reviewedAt: '20.09.2026',
  reviewedAtISO: '2026-09-20',
} as const;

export const contactHref = `mailto:${site.email}?subject=${encodeURIComponent('Trao đổi pilot Lumi BI')}&body=${encodeURIComponent('Chào Lumi,\n\nTôi muốn trao đổi về pilot Lumi BI.\n\nDoanh nghiệp:\nHệ thống đang dùng:\nCâu hỏi kinh doanh cần trả lời:\nCách liên hệ thuận tiện:\n\nCảm ơn Lumi.')}`;

export const navigation = [
  { href: '/#gia-tri', label: 'Giá trị' },
  { href: '/#minh-hoa', label: 'Khám phá' },
  { href: '/#ket-noi', label: 'Kết nối' },
  { href: '/#cau-hoi', label: 'Câu hỏi thường gặp' },
];

// Roadmap intent, NOT partner logos, API approval or production connector status.
export const connectors = [
  { name: 'Nhanh.vn', kind: 'Bán hàng & kho', status: 'Tích hợp dự kiến', mark: 'N' },
  { name: 'Haravan', kind: 'Website & bán lẻ', status: 'Tích hợp dự kiến', mark: 'H' },
  { name: 'Shopee', kind: 'Đơn hàng & đối soát', status: 'Tích hợp dự kiến', mark: 'S' },
  { name: 'CSV / Excel', kind: 'Dữ liệu sẵn có', status: 'Trong lộ trình', mark: '↳' },
  { name: 'API riêng', kind: 'Theo hệ thống của bạn', status: 'Cần khảo sát', mark: '{ }' },
];

export const decisions = [
  { number: '01', label: 'TIỀN & LỢI NHUẬN', title: 'Bán được bao nhiêu.\nGiữ lại bao nhiêu?', text: 'Phân biệt doanh thu, tiền thực nhận và phần lãi còn lại. Không gọi một đơn hàng đã bán là tiền đã về.', question: 'Khoản nào chưa đối soát? Chi phí nào còn thiếu?', href: '#demo-money', glyph: 'money' },
  { number: '02', label: 'HÀNG TỒN', title: 'Hàng nào cần nhập.\nHàng nào cần giải phóng?', text: 'Đặt tồn kho cạnh sức bán và độ mới của dữ liệu. Thấy chỗ thiếu hàng mà không bỏ quên vốn đang nằm yên.', question: 'Nên kiểm tra mã hàng nào trước khi đặt thêm?', href: '#demo-stock', glyph: 'stock' },
  { number: '03', label: 'NGOẠI LỆ VẬN HÀNH', title: 'Việc gì đang lệch.\nAi cần xử lý tiếp?', text: 'Đưa chênh lệch, đơn bất thường và dữ liệu chưa khớp về một danh sách ưu tiên có người phụ trách.', question: 'Điều gì đang cần con người xem xét?', href: '#demo-operations', glyph: 'exception' },
] as const;

export const faqs = [
  { question: 'Lumi BI có thay phần mềm bán hàng của tôi không?', answer: 'Không. Định hướng của Lumi BI là bổ sung lớp phân tích trên những hệ thống bạn đang dùng. Phạm vi dữ liệu, quyền truy cập và cách kết nối sẽ được xác nhận trước từng pilot; không mặc định phải thay quy trình đang vận hành.' },
  { question: 'Hiện đã kết nối được Nhanh, Haravan và Shopee chưa?', answer: 'Chưa. Đây là các tích hợp ưu tiên trong lộ trình, chưa phải kết nối thương mại đã phát hành. Khả năng truy cập API, quyền đối tác, loại tài khoản và dữ liệu thực tế cần được kiểm chứng riêng. Đăng ký pilot không đồng nghĩa được kích hoạt kết nối ngay.' },
  { question: 'Các con số trên trang này có phải kết quả của khách hàng?', answer: 'Không. Toàn bộ tình huống và số liệu trong phần khám phá là dữ liệu giả lập để minh họa hướng sản phẩm. Chúng không phải báo cáo trực tiếp, kết quả thử nghiệm khách hàng hay cam kết về lợi nhuận.' },
  { question: 'AI sẽ tự tính số và tự thao tác trên cửa hàng?', answer: 'Ask Lumi vẫn trong lộ trình. Thiết kế yêu cầu AI giải thích kết quả từ định nghĩa chỉ số được kiểm soát, nêu nguồn và nói rõ phần chưa biết. Một phân tích không phải quyền tự sửa giá, đặt hàng, chuyển tiền hay gửi thông tin. Trang minh họa này không gọi mô hình AI và không thao tác với cửa hàng.' },
  { question: 'Dữ liệu của doanh nghiệp sẽ được bảo vệ thế nào?', answer: 'Kiến trúc nền tảng có xác thực, kiểm tra quyền truy cập và cơ sở dữ liệu phục vụ riêng theo doanh nghiệp. Đây không phải cam kết cách ly tuyệt đối hay chứng nhận bảo mật. Phạm vi triển khai, người được truy cập, dữ liệu cần dùng và điều kiện vận hành phải được thống nhất, kiểm thử trước pilot.' },
  { question: 'Pilot có giá bao nhiêu và bắt đầu như thế nào?', answer: 'Chưa công bố bảng giá cố định. Cuộc trao đổi đầu tiên dùng để chọn một câu hỏi, một nguồn dữ liệu và tiêu chí kiểm chứng. Phạm vi, phí triển khai, phí duy trì (nếu có) và điều kiện dừng được thống nhất trước khi bắt đầu; không có khoản thanh toán hoặc đăng ký tự động trên trang này.' },
];
