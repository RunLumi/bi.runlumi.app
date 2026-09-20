/** Synthetic, independent scenarios. Never fetch or resemble live tenant data. */
export type Scenario = {
  id: string; tab: string; number: string; title: string; subtitle: string;
  metrics: { label: string; value: string; unit?: string; note: string; unknown?: boolean }[];
  series: number[]; ceiling: number; chartTitle: string; chartUnit: string;
  insightTitle: string; insight: string; next: string; caveat: string;
  source: string; definition: string; limit: string;
};

export const scenarios: Scenario[] = [
  {
    id: 'money', tab: 'Tiền & lợi nhuận', number: '01',
    title: 'Doanh thu tốt. Tiền đã về đủ chưa?',
    subtitle: 'Phân biệt số đã bán, tiền chờ đối soát và phần chưa thể kết luận.',
    metrics: [
      { label: 'Doanh thu thuần', value: '486,0', unit: 'triệu ₫', note: '512,0 triệu − 26,0 triệu hoàn trả' },
      { label: 'Tiền chờ đối soát', value: '52,4', unit: 'triệu ₫', note: 'Cần kiểm tra bảng kê thanh toán' },
      { label: 'Lãi đóng góp', value: 'Chưa đủ dữ liệu', note: '8 SKU thiếu giá vốn · không gán bằng 0', unknown: true },
    ],
    series: [44, 51, 72, 65, 78, 81, 95], ceiling: 100,
    chartTitle: 'Doanh thu thuần theo ngày', chartUnit: 'triệu ₫',
    insightTitle: 'Doanh thu chưa phải lợi nhuận.',
    insight: 'Chưa thể kết luận lãi khi 8 mã hàng còn thiếu giá vốn. Khoản 52,4 triệu đang chờ đối soát cũng chưa phải tiền đã thực nhận.',
    next: 'Bổ sung giá vốn và kiểm tra bảng kê trước khi tăng ngân sách.',
    caveat: 'Gợi ý minh họa · cần người phụ trách kiểm tra',
    source: 'Tệp đơn hàng mẫu + tệp hoàn trả mẫu + bảng kê thanh toán mẫu. Không có API trực tiếp.',
    definition: 'Trong tình huống này: doanh thu thuần = doanh thu ghi nhận trước hoàn trả 512.000.000 ₫ − hoàn trả 26.000.000 ₫ = 486.000.000 ₫. Các tệp dùng cùng quy ước thuế; đây không phải định nghĩa mặc định cho mọi doanh nghiệp.',
    limit: 'Thiếu giá vốn của 8 SKU và chưa xác nhận đầy đủ chi phí. Không tính lãi đóng góp. Số chờ đối soát không được gọi là doanh thu hoặc tiền thực nhận.',
  },
  {
    id: 'stock', tab: 'Hàng tồn', number: '02',
    title: 'Nhập thêm hàng. Hay xử lý hàng đang nằm?',
    subtitle: 'Đọc tồn kho cùng sức bán, không nhìn một số lượng riêng lẻ.',
    metrics: [
      { label: 'Mã hàng cần kiểm tra', value: '6', unit: 'SKU', note: 'Tồn thấp so với sức bán trong tệp mẫu' },
      { label: 'Mã hàng chậm bán', value: '14', unit: 'SKU', note: 'Không có đơn trong 30 ngày mẫu' },
      { label: 'Độ mới của tệp kho', value: '2', unit: 'ngày', note: 'Cần cập nhật trước khi chốt nhập hàng' },
    ],
    series: [12, 18, 15, 22, 25, 32, 30], ceiling: 40,
    chartTitle: 'Sức bán của mã hàng A', chartUnit: 'sản phẩm',
    insightTitle: 'Sức bán tăng. Tồn kho chưa chắc còn đúng.',
    insight: 'Mã hàng A bán nhanh hơn trong tuần mẫu, nhưng tệp kho đã cũ 2 ngày. Một đề xuất nhập hàng cần cả số tồn mới và thời gian giao của nhà cung cấp.',
    next: 'Kiểm tra tồn thực tế, hàng đang về và thời gian bổ sung hàng.',
    caveat: 'Tình huống độc lập · không phải dự báo nhu cầu',
    source: 'Tệp kho mẫu ngày 05.09.2026 và tệp bán hàng mẫu từ 01–07.09.2026.',
    definition: 'Sức bán là số sản phẩm mã A bán mỗi ngày trong tệp mẫu. 14 SKU chậm bán là các mã không có đơn trong 30 ngày của tình huống. Không nội suy xác suất hết hàng.',
    limit: 'Tệp kho cũ 2 ngày. Chưa có thời gian giao, hàng đang về và kiểm đếm thực tế. Không đủ cơ sở tự đặt hàng.',
  },
  {
    id: 'operations', tab: 'Ngoại lệ vận hành', number: '03',
    title: 'Đừng để việc nhỏ lệch thành vấn đề lớn.',
    subtitle: 'Nhìn ngoại lệ cùng bằng chứng và bước kiểm tra tiếp theo.',
    metrics: [
      { label: 'Ngoại lệ đang mở', value: '24', unit: 'việc', note: 'Tại thời điểm chốt tình huống mẫu' },
      { label: 'Việc chưa có người xử lý', value: '7', unit: 'việc', note: 'Cần phân công trước khi theo dõi tiếp' },
      { label: 'Khoản chưa khớp', value: '3', unit: 'khoản', note: 'Chưa xác nhận nguyên nhân chênh lệch' },
    ],
    series: [7, 9, 5, 12, 10, 8, 6], ceiling: 15,
    chartTitle: 'Ngoại lệ mới theo ngày', chartUnit: 'việc',
    insightTitle: 'Thấy ngoại lệ. Rõ người xem xét.',
    insight: 'Trong 24 việc còn mở, 7 việc chưa được phân công. Ba khoản chưa khớp cần kiểm tra chứng từ; chưa đủ bằng chứng để gọi là thất thoát.',
    next: 'Giao người kiểm tra, đính kèm chứng từ và xác nhận kết quả.',
    caveat: 'Không tự gửi nhắc việc hoặc sửa dữ liệu nguồn',
    source: 'Danh sách ngoại lệ và chứng từ giả lập. Không phải thông báo vận hành thật.',
    definition: 'Biểu đồ đếm ngoại lệ mới từng ngày (57 việc trong tuần). 24 việc đang mở là số dư chưa xử lý tại cuối kỳ, không phải tổng phát sinh.',
    limit: 'Chưa xác định nguyên nhân ba khoản chênh lệch. Không suy luận gian lận, thất thoát hay lỗi nhân sự từ dữ liệu này.',
  },
];

export function chartPoints(values: number[], ceiling: number): string {
  return values.map((value, index) => `${48 + index * 84},${188 - (value / ceiling) * 148}`).join(' ');
}
