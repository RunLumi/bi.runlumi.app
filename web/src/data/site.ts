export const site = {
  name: 'Lumi BI',
  origin: 'https://bi.runlumi.app',
  description: 'Lumi BI: hướng tới một nơi để nhìn rõ dòng tiền, tồn kho và ngoại lệ vận hành từ các kênh bán hàng. Khám phá bản xem trước và trao đổi pilot.',
  email: import.meta.env.PUBLIC_CONTACT_EMAIL || 'hello@runlumi.app',
};
if (!/^[^\s@?<>]+@[^\s@?<>]+\.[^\s@?<>]+$/.test(site.email)) {
  throw new Error('PUBLIC_CONTACT_EMAIL must be one valid public email address.');
}
export const pilotHref = `mailto:${site.email}?subject=${encodeURIComponent('Trao đổi pilot Lumi BI')}&body=${encodeURIComponent('Chào Lumi,\n\nTôi muốn trao đổi về pilot Lumi BI.\n\nDoanh nghiệp / thương hiệu:\nCác hệ thống đang dùng:\nMột câu hỏi kinh doanh cần trả lời:\nThông tin liên hệ thuận tiện:\n\nCảm ơn!')}`;
