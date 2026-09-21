import { AppError, object, day, text, type Query } from './contracts.ts';
export interface Metric { id: string; label: string; unit: 'count'|'hours'|'VND'; expression: string; definition: string }
// SQL expressions are reviewed product code, NEVER supplied by browsers or models.
export const metrics: readonly Metric[] = [
  { id:'cases', label:'Lượt xử lý', unit:'count', expression:'COALESCE(SUM(f.cases), 0)', definition:'Tổng lượt xử lý trong các snapshot nguồn đang hiệu lực.' },
  { id:'baseline_hours', label:'Giờ làm thủ công theo mốc so sánh', unit:'hours', expression:'COALESCE(SUM(f.baseline_minutes), 0) / 60.0', definition:'Khối lượng công việc tương đương trước tự động hóa; cùng phạm vi và sản lượng.' },
  { id:'human_hours', label:'Giờ người còn lại', unit:'hours', expression:'COALESCE(SUM(f.human_minutes), 0) / 60.0', definition:'Thời gian người thực tế, gồm kiểm tra, xử lý ngoại lệ và làm lại.' },
  { id:'released_hours', label:'Giờ công được giải phóng', unit:'hours', expression:'COALESCE(SUM(f.baseline_minutes - f.human_minutes), 0) / 60.0', definition:'Baseline trừ giờ người còn lại. Có thể âm. Không phải tiền mặt tiết kiệm.' },
  { id:'runtime_cost_vnd', label:'Chi phí chạy AI', unit:'VND', expression:'COALESCE(SUM(f.runtime_cost_vnd), 0)', definition:'Chi phí chạy được phân bổ cho sản lượng trong kỳ; đơn vị đồng Việt Nam.' },
  { id:'cash_savings_vnd', label:'Tiền mặt tiết kiệm có chứng từ tham chiếu', unit:'VND', expression:'COALESCE(SUM(f.cash_savings_vnd), 0)', definition:'Số tiền do chủ dữ liệu cung cấp, có mã bằng chứng. RunLumi chưa kiểm toán chứng từ.' },
  { id:'net_cash_benefit_vnd', label:'Lợi ích tiền mặt ròng', unit:'VND', expression:'COALESCE(SUM(f.cash_savings_vnd - f.runtime_cost_vnd - f.support_cost_vnd), 0)', definition:'Tiền mặt tiết kiệm trừ phí chạy và hỗ trợ/phí định kỳ đã phân bổ. Không cộng giá trị giờ công.' }
];
const metricMap = new Map(metrics.map(m => [m.id, m]));
export function getMetric(name: string): Metric {
  const metric = metricMap.get(name);
  if (!metric) throw new AppError(400, 'UNKNOWN_METRIC');
  return metric;
}
export function parseQuery(value: unknown): Query {
  const v = object(value, ['metrics', 'from', 'to', 'groupBy']);
  if (!Array.isArray(v.metrics) || !v.metrics.length || v.metrics.length > 7) throw new AppError(400, 'INVALID_METRICS');
  const names = v.metrics.map(x => getMetric(text(x, 64)).id);
  if (new Set(names).size !== names.length) throw new AppError(400, 'DUPLICATE_METRIC');
  const from = day(v.from); const to = day(v.to);
  const days = (Date.parse(to) - Date.parse(from)) / 86_400_000;
  if (days <= 0 || days > 93) throw new AppError(400, 'DATE_RANGE_MUST_BE_1_TO_93_DAYS');
  const groupBy = v.groupBy ?? 'none';
  if (groupBy !== 'none' && groupBy !== 'day' && groupBy !== 'workflow') throw new AppError(400, 'INVALID_GROUP');
  return { metrics: names, from, to, groupBy };
}
export function compileInstallationQuery(query: Query): { sql: string; params: string[] } {
  // Revalidate at the compiler boundary: typed callers and agents are not authority.
  const q = parseQuery(query);
  const group = q.groupBy === 'day' ? 'f.business_day' : q.groupBy === 'workflow' ? 'f.workflow' : null;
  const selects = q.metrics.map(name => { const m = getMetric(name); return `${m.expression} AS "${m.id}"`; });
  selects.push('COUNT(*) AS matched_rows');
  if (group) selects.unshift(`${group} AS dimension`);
  return {
    sql: `SELECT ${selects.join(', ')} FROM workflow_facts f JOIN active_snapshots a ON a.snapshot_id = f.snapshot_id JOIN sources src ON src.id=a.source_id AND src.state='active' WHERE f.business_day >= ? AND f.business_day < ?${group ? ` GROUP BY ${group} ORDER BY ${group}` : ''} LIMIT 201`,
    params: [q.from, q.to]
  };
}
export interface Widget { id: string; kind: 'kpi'|'bar'|'table'; title: string; metrics: string[]; groupBy: Query['groupBy'] }
export interface Dashboard { version: 1; title: string; widgets: Widget[] }
export function parseDashboard(value: unknown): Dashboard {
  const v = object(value, ['version','title','widgets']);
  if (v.version !== 1 || !Array.isArray(v.widgets) || !v.widgets.length || v.widgets.length > 12) throw new AppError(400,'INVALID_DASHBOARD');
  const seen = new Set<string>();
  const widgets = v.widgets.map(raw => {
    const w = object(raw, ['id','kind','title','metrics','groupBy']);
    const widgetId = text(w.id,64);
    if (!/^[a-z][a-z0-9_-]*$/.test(widgetId) || seen.has(widgetId)) throw new AppError(400,'INVALID_WIDGET_ID');
    seen.add(widgetId);
    if (w.kind !== 'kpi' && w.kind !== 'bar' && w.kind !== 'table') throw new AppError(400,'INVALID_WIDGET_KIND');
    const q = parseQuery({metrics:w.metrics, groupBy:w.groupBy, from:'2026-01-01',to:'2026-01-02'});
    if (w.kind === 'kpi' && (q.metrics.length !== 1 || q.groupBy !== 'none')) throw new AppError(400,'INVALID_KPI');
    if (w.kind === 'bar' && (q.metrics.length !== 1 || q.groupBy === 'none')) throw new AppError(400,'INVALID_BAR');
    return {id:widgetId,kind:w.kind,title:text(w.title,120),metrics:q.metrics,groupBy:q.groupBy} as Widget;
  });
  return {version:1,title:text(v.title,120),widgets};
}
