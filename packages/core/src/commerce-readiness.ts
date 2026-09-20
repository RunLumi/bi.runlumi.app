/** Deployment capability inventory, not merchant source health or a fabricated demo. */
export const commerceReadiness = {
  contract:'lumi.readiness.v1',
  stage:'foundation',
  products:[
    {id:'money-truth',name:'Tiền & lợi nhuận',question:'Doanh thu nào đã ghi nhận? Tiền nào chưa về?',state:'PARTIAL',missing:['Đã có bản xuất chuẩn hóa, liên kết danh tính và duyệt công bố','Còn cần nguồn trực tiếp, dữ liệu dòng hàng và chứng nhận kế toán']},
    {id:'stock-decisions',name:'Quyết định tồn kho',question:'Mặt hàng nào sắp thiếu, mặt hàng nào đang nằm lâu?',state:'PARTIAL',missing:['Đã có quan sát khả dụng theo kho vật lý và mốc nguồn','Còn cần lịch sử nhập/xuất, nhu cầu và chính sách bổ sung']},
    {id:'operations-exceptions',name:'Ngoại lệ vận hành',question:'Đơn hàng nào cần xử lý, công việc nào đang tốn người?',state:'PARTIAL',missing:['Đã có phát hiện điều kiện quan sát, sổ việc và kiểm chứng kết quả','Còn cần sự kiện giao hàng, hoàn trả và nguồn commerce trực tiếp']}
  ],
  connectors:[
    {id:'nhanh',name:'Nhanh.vn',state:'NOT_CONNECTED',certification:'NOT_IMPLEMENTED'},
    {id:'haravan',name:'Haravan',state:'NOT_CONNECTED',certification:'NOT_IMPLEMENTED'},
    {id:'shopee',name:'Shopee',state:'ACCESS_NOT_VERIFIED',certification:'NOT_IMPLEMENTED'}
  ],
  implemented:{authorizedExports:true,normalization:true,reviewedPublication:true,observedFindings:true,decisionRegister:true,privateExports:true},
  askLumi:{inferenceImplemented:false,actionsEnabled:false},
  nextEvidence:'Một nguồn vận hành + một kỳ đối soát đã chốt + ba chỉ số được doanh nghiệp xác nhận.'
} as const;
