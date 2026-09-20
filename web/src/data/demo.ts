/** Synthetic editorial fixture. Never import customer data or call the BI API here. */
export const demo = {
  period: '01–07/09/2026',
  timezone: 'Asia/Ho_Chi_Minh (UTC+7)',
  gross: 1_280_000_000,
  returns: 80_000_000,
  costs: [
    { label: 'Giá vốn hàng bán', amount: 660_000_000 },
    { label: 'Phí sàn & thanh toán', amount: 96_000_000 },
    { label: 'Giao hàng & xử lý đơn', amount: 72_000_000 },
    { label: 'Quảng cáo phân bổ', amount: 144_000_000 },
  ],
  daily: [120, 148, 132, 180, 165, 205, 250].map((million, index) => ({
    day: `0${index + 1}/09`, amount: million * 1_000_000,
  })),
  sources: ['Đơn hàng giả lập', 'Chi phí giả lập', 'Hoàn trả giả lập'],
} as const;
export const netRevenue = demo.gross - demo.returns;
export const contribution = netRevenue - demo.costs.reduce((sum, row) => sum + row.amount, 0);
export const contributionRate = contribution / netRevenue;
export const stock = [
  { sku: 'Linen / kem / M', onHand: 48, dailyUnits: 12, leadDays: 7 },
  { sku: 'Polo / navy / L', onHand: 126, dailyUnits: 9, leadDays: 5 },
  { sku: 'Tote / tự nhiên', onHand: 240, dailyUnits: 8, leadDays: 4 },
] as const;
export function daysCover(onHand: number, dailyUnits: number): number | null {
  if (!Number.isFinite(onHand) || !Number.isFinite(dailyUnits) || onHand < 0 || dailyUnits <= 0) return null;
  return onHand / dailyUnits;
}
export function million(amount: number): string {
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(amount / 1_000_000);
}
export function percent(ratio: number): string {
  return new Intl.NumberFormat('vi-VN', { style: 'percent', maximumFractionDigits: 1 }).format(ratio);
}
