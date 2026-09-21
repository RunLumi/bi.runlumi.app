/** Synthetic, independent scenarios. Never fetch or resemble live installation data. */
export type Scenario = {
  id: string; tab: string; number: string; title: string; subtitle: string;
  metrics: { label: string; value: string; unit?: string; note: string; unknown?: boolean }[];
  series: number[]; ceiling: number; chartTitle: string; chartUnit: string;
  insightTitle: string; insight: string; next: string; caveat: string;
  source: string; definition: string; limit: string;
};

export const scenarios: Scenario[] = [
  {
    id: 'money', tab: 'Tiền và lợi nhuận', number: '01',
    title: 'Bán được hàng. Tiền đã về đủ chưa?',
    subtitle: 'Cùng một tuần bán hàng, tách rõ doanh thu, tiền chờ đối soát và phần chưa thể tính lãi.',
    metrics: [
      { label: 'Doanh thu thuần', value: '486,0', unit: 'triệu ₫', note: '512,0 triệu − 26,0 triệu hoàn trả' },
      { label: 'Tiền chờ đối soát', value: '52,4', unit: 'triệu ₫', note: 'Cần kiểm tra bảng kê thanh toán' },
      { label: 'Lãi đóng góp', value: 'Chưa đủ dữ liệu', note: '8 mã hàng chưa có giá vốn', unknown: true },
    ],
    series: [44, 51, 72, 65, 78, 81, 95], ceiling: 100,
    chartTitle: 'Doanh thu thuần theo ngày', chartUnit: 'triệu ₫',
    insightTitle: 'Bán tốt chưa chắc lãi tốt.',
    insight: '8 mã hàng chưa có giá vốn nên chưa thể tính lãi đóng góp. Khoản 52,4 triệu đồng đang chờ đối soát cũng chưa thể coi là tiền đã về.',
    next: 'Bổ sung giá vốn, kiểm tra bảng kê thanh toán rồi mới đánh giá hiệu quả bán hàng.',
    caveat: 'Nhận định minh họa · cần đối chiếu với chứng từ',
    source: 'Tệp đơn hàng mẫu + tệp hoàn trả mẫu + bảng kê thanh toán mẫu. Không có API trực tiếp.',
    definition: 'Trong tình huống này: doanh thu thuần = doanh thu ghi nhận trước hoàn trả 512.000.000 ₫ − hoàn trả 26.000.000 ₫ = 486.000.000 ₫. Các tệp dùng cùng quy ước thuế; đây không phải định nghĩa mặc định cho mọi doanh nghiệp.',
    limit: 'Thiếu giá vốn của 8 mã hàng và chưa xác nhận đầy đủ chi phí. Không tính lãi đóng góp. Số chờ đối soát không được gọi là doanh thu hoặc tiền thực nhận.',
  },
  {
    id: 'stock', tab: 'Tồn kho', number: '02',
    title: 'Nên nhập thêm hay bán bớt hàng đang có?',
    subtitle: 'Nhìn hàng trong kho cùng nhịp bán để biết điều gì cần kiểm tra trước khi nhập thêm.',
    metrics: [
      { label: 'Mã hàng cần kiểm tra', value: '6', unit: 'mã', note: 'Tồn thấp so với nhịp bán trong dữ liệu mẫu' },
      { label: 'Mã hàng chậm bán', value: '14', unit: 'mã', note: '30 ngày chưa ghi nhận đơn trong dữ liệu mẫu' },
      { label: 'Lần cập nhật tồn kho', value: '2', unit: 'ngày trước', note: 'Cần cập nhật trước khi chốt nhập hàng' },
    ],
    series: [12, 18, 15, 22, 25, 32, 30], ceiling: 40,
    chartTitle: 'Sức bán của mã hàng A', chartUnit: 'sản phẩm',
    insightTitle: 'Bán nhanh hơn. Nhưng số tồn đã cũ.',
    insight: 'Mã hàng A bán nhanh hơn trong tuần minh họa, nhưng tệp kho đã cũ 2 ngày. Trước khi nhập thêm, cần biết số tồn hiện tại và khi nào nhà cung cấp giao được hàng.',
    next: 'Kiểm tra tồn thực tế, hàng đang về và thời gian giao hàng của nhà cung cấp.',
    caveat: 'Tình huống độc lập · không phải dự báo nhu cầu',
    source: 'Tệp kho mẫu ngày 05.09.2026 và tệp bán hàng mẫu từ 01–07.09.2026.',
    definition: 'Sức bán là số sản phẩm mã A bán mỗi ngày trong tệp mẫu. 14 mã hàng chậm bán là các mã không có đơn trong 30 ngày của tình huống. Không nội suy xác suất hết hàng.',
    limit: 'Tệp kho cũ 2 ngày. Chưa có thời gian giao, hàng đang về và kiểm đếm thực tế. Không đủ cơ sở tự đặt hàng.',
  },
  {
    id: 'operations', tab: 'Việc cần xử lý', number: '03',
    title: 'Việc cần làm đã có người theo dõi chưa?',
    subtitle: 'Biết việc nào còn mở, ai đang phụ trách và khoản nào cần đối chiếu.',
    metrics: [
      { label: 'Việc chưa xử lý xong', value: '24', unit: 'việc', note: 'Tại thời điểm chốt dữ liệu mẫu' },
      { label: 'Việc chưa có người phụ trách', value: '7', unit: 'việc', note: 'Cần phân công trước khi theo dõi tiếp' },
      { label: 'Khoản chưa khớp', value: '3', unit: 'khoản', note: 'Chưa xác nhận nguyên nhân chênh lệch' },
    ],
    series: [7, 9, 5, 12, 10, 8, 6], ceiling: 15,
    chartTitle: 'Việc phát sinh theo ngày', chartUnit: 'việc',
    insightTitle: '7 việc vẫn chưa có người phụ trách.',
    insight: 'Trong 24 việc chưa xử lý xong, 7 việc chưa được phân công. Ba khoản chưa khớp cần kiểm tra chứng từ, chưa thể kết luận là tiền bị thất thoát.',
    next: 'Phân công người kiểm tra, bổ sung chứng từ và ghi lại kết quả xử lý.',
    caveat: 'Không tự gửi nhắc việc hoặc sửa dữ liệu nguồn',
    source: 'Danh sách ngoại lệ và chứng từ giả lập. Không phải thông báo vận hành thật.',
    definition: 'Biểu đồ đếm ngoại lệ mới từng ngày (57 việc trong tuần). 24 việc đang mở là số dư chưa xử lý tại cuối kỳ, không phải tổng phát sinh.',
    limit: 'Chưa xác định nguyên nhân ba khoản chênh lệch. Không suy luận gian lận, thất thoát hay lỗi nhân sự từ dữ liệu này.',
  },
];

export function chartPoints(values: number[], ceiling: number): string {
  return values.map((value, index) => `${48 + index * 84},${188 - (value / ceiling) * 148}`).join(' ');
}
