/** Deployment capability inventory, not merchant source health or a fabricated demo. */
export const commerceReadiness = {
  contract:'lumi.readiness.v1',
  stage:'foundation',
  products:[
    {id:'money-truth',name:'Tiền & lợi nhuận',question:'Doanh thu nào đã ghi nhận? Tiền nào chưa về?',state:'NOT_IMPLEMENTED',missing:['Đơn hàng chuẩn hóa và chống đếm trùng','Giá vốn, phí và kỳ đối soát được xác nhận']},
    {id:'stock-decisions',name:'Quyết định tồn kho',question:'Mặt hàng nào sắp thiếu, mặt hàng nào đang nằm lâu?',state:'NOT_IMPLEMENTED',missing:['Định danh kho vật lý và SKU dùng chung','Tồn kho có mốc thời gian và lịch sử nhập/xuất']},
    {id:'operations-exceptions',name:'Ngoại lệ vận hành',question:'Đơn hàng nào cần xử lý, công việc nào đang tốn người?',state:'PARTIAL',missing:['Luồng ngoại lệ đơn hàng, giao hàng và hoàn trả','Đã có dashboard đo chi phí thao tác; chưa có nguồn commerce trực tiếp']}
  ],
  connectors:[
    {id:'nhanh',name:'Nhanh.vn',state:'NOT_CONNECTED',certification:'NOT_IMPLEMENTED'},
    {id:'haravan',name:'Haravan',state:'NOT_CONNECTED',certification:'NOT_IMPLEMENTED'},
    {id:'shopee',name:'Shopee',state:'ACCESS_NOT_VERIFIED',certification:'NOT_IMPLEMENTED'}
  ],
  askLumi:{inferenceImplemented:false,actionsEnabled:false},
  nextEvidence:'Một nguồn vận hành + một kỳ đối soát đã chốt + ba chỉ số được doanh nghiệp xác nhận.'
} as const;
