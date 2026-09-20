import { publicContactEmail } from './contact';
const contactEmail = publicContactEmail(import.meta.env.PUBLIC_CONTACT_EMAIL || 'hello@runlumi.app');

export const site = {
  name: 'Lumi BI',
  origin: 'https://bi.runlumi.app',
  email: contactEmail,
  title: 'Lumi BI | Rõ tiền. Rõ hàng. Vững quyết định.',
  description: 'Hiểu doanh thu, tiền về và tồn kho trong cùng một góc nhìn. Khám phá bản minh họa Lumi BI và trao đổi về bài toán kinh doanh của bạn.',
  reviewedAt: '20.09.2026',
} as const;

export const contactHref = `mailto:${site.email}?subject=${encodeURIComponent('Tìm hiểu Lumi BI cho doanh nghiệp')}&body=${encodeURIComponent('Chào đội ngũ Lumi,\n\nTôi muốn tìm hiểu Lumi BI có phù hợp với doanh nghiệp của mình không.\n\nTên doanh nghiệp:\nPhần mềm và kênh bán hàng đang dùng:\nVấn đề muốn làm rõ:\nCách liên hệ thuận tiện:\n\nCảm ơn Lumi.')}`;

export const navigation = [
  { href: '/#gia-tri', label: 'Lumi BI giúp gì?' },
  { href: '/#minh-hoa', label: 'Xem minh họa' },
  { href: '/#ket-noi', label: 'Kết nối' },
  { href: '/#cau-hoi', label: 'Câu hỏi thường gặp' },
];

// Roadmap intent, not partner endorsements or live connector availability.
export const connectors = [
  { name: 'Nhanh.vn', kind: 'Bán hàng và quản lý kho', status: 'Tích hợp dự kiến', mark: 'N' },
  { name: 'Haravan', kind: 'Website và bán lẻ', status: 'Tích hợp dự kiến', mark: 'H' },
  { name: 'Shopee', kind: 'Đơn hàng và đối soát', status: 'Tích hợp dự kiến', mark: 'S' },
  { name: 'CSV / Excel', kind: 'Báo cáo từ phần mềm', status: 'Trong lộ trình', mark: '↳' },
  { name: 'API riêng', kind: 'Hệ thống của doanh nghiệp', status: 'Cần khảo sát', mark: '{ }' },
];

export const decisions = [
  {
    number: '01', label: 'TIỀN VÀ LỢI NHUẬN',
    title: 'Bán được nhiều hơn.\nCó còn lại nhiều hơn?',
    text: 'Đặt doanh thu cạnh hoàn trả, giá vốn và các khoản phí. Phân biệt tiền đã về, tiền còn chờ và phần chưa đủ dữ liệu để tính lãi.',
    question: 'Tiền còn chờ ở đâu? Đã tính đủ chi phí chưa?',
    href: '#demo-money', glyph: 'money',
  },
  {
    number: '02', label: 'TỒN KHO',
    title: 'Đủ hàng để bán.\nKhông giữ hàng quá lâu.',
    text: 'Nhìn tồn kho cùng nhịp bán để biết mã nào cần kiểm tra trước khi nhập thêm. Không bỏ quên vốn đang nằm trong những mặt hàng chậm bán.',
    question: 'Hàng nào cần bổ sung? Hàng nào nên bán bớt?',
    href: '#demo-stock', glyph: 'stock',
  },
  {
    number: '03', label: 'VIỆC CẦN XỬ LÝ',
    title: 'Thấy việc cần chú ý.\nRõ người cần xử lý.',
    text: 'Từ đơn chậm đến khoản chưa khớp, đặt những việc cần xem xét cạnh chứng từ và người phụ trách. Bớt bỏ sót giữa nhiều báo cáo.',
    question: 'Việc nào cần xử lý trước? Ai đang theo dõi?',
    href: '#demo-operations', glyph: 'exception',
  },
] as const;

export const faqs = [
  {
    question: 'Lumi BI có phù hợp với doanh nghiệp của tôi không?',
    answer: 'Lumi BI tập trung vào doanh nghiệp thương mại, bán lẻ và bán hàng đa kênh, nơi đơn hàng, tiền về và tồn kho nằm ở nhiều hệ thống. Điểm bắt đầu là một câu hỏi cụ thể mà báo cáo hiện tại chưa trả lời rõ. Buổi trao đổi đầu tiên giúp hai bên xác định nhu cầu đó có phù hợp với khả năng hiện tại của Lumi BI không.',
  },
  {
    question: 'Tôi có thể dùng Lumi BI ngay chưa?',
    answer: 'Lumi BI đang ở giai đoạn thử nghiệm. Nền tảng đã có luồng tiếp nhận tệp dữ liệu được cấp quyền, đối chiếu nguồn và xem số liệu thương mại, nhưng chưa được nghiệm thu để vận hành thực tế tại doanh nghiệp. Bạn có thể trao đổi nhu cầu để cùng xác định phạm vi triển khai thử; chưa có gói tự đăng ký và dùng ngay.',
  },
  {
    question: 'Tôi có phải đổi phần mềm bán hàng không?',
    answer: 'Mục tiêu của Lumi BI là bổ sung góc nhìn phân tích, không thay phần mềm bán hàng hay quản lý kho của bạn. Cách lấy dữ liệu và phạm vi kết nối sẽ được kiểm tra trước khi triển khai thử. Không mặc định rằng doanh nghiệp phải đổi hệ thống hoặc làm lại quy trình đang dùng.',
  },
  {
    question: 'Đã có kết nối trực tiếp với Nhanh.vn, Haravan và Shopee chưa?',
    answer: 'Chưa. Đây là ba tích hợp được ưu tiên trong lộ trình. Khả năng kết nối phụ thuộc quyền truy cập dữ liệu, loại tài khoản và giới hạn của từng nền tảng. Lumi sẽ kiểm tra những điều này trước khi thống nhất phạm vi triển khai, thay vì hứa rằng mọi hệ thống đều kết nối được ngay.',
  },
  {
    question: 'Các con số trên website có phải kết quả của khách hàng?',
    answer: 'Không. Các tình huống và số liệu được tạo riêng để bạn trải nghiệm cách đọc báo cáo, xem nhận định và kiểm tra nguồn. Chúng không phải dữ liệu khách hàng, kết quả triển khai thực tế hay cam kết tăng doanh thu, lợi nhuận.',
  },
  {
    question: 'AI có tự quyết định và thay đổi dữ liệu không?',
    answer: 'Tính năng hỏi đáp bằng AI, Ask Lumi, chưa được phát hành. Hướng phát triển là giúp bạn hiểu số liệu, xem nguồn và cân nhắc việc cần làm. Một gợi ý không tự cấp quyền sửa giá, đặt hàng, chuyển tiền hay gửi thông tin. Bản minh họa trên website không gọi AI và không thao tác với hệ thống của bạn.',
  },
  {
    question: 'Ai được xem dữ liệu của doanh nghiệp?',
    answer: 'Nền tảng có cơ chế kiểm tra danh tính, quyền truy cập và cơ sở dữ liệu phục vụ riêng theo doanh nghiệp. Trước khi triển khai thử, hai bên cần thống nhất dữ liệu nào được dùng, ai được xem và cách kiểm tra các quyền đó. Cách triển khai và quyền truy cập phải được kiểm thử trước khi đưa dữ liệu thật vào hệ thống.',
  },
  {
    question: 'Chi phí triển khai được tính như thế nào?',
    answer: 'Lumi BI chưa công bố bảng giá cố định. Chi phí phụ thuộc nguồn dữ liệu, mức độ kết nối và bài toán cần giải quyết. Phí triển khai, phí duy trì nếu có, phạm vi công việc và cách nghiệm thu sẽ được thống nhất trước khi bắt đầu. Gửi email tìm hiểu không tạo đăng ký trả phí.',
  },
];
