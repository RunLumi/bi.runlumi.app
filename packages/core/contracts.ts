export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  constructor(status: number, code: string) { super(code); this.status = status; this.code = code; }
}
export function object(value: unknown, allowed: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new AppError(400, 'INVALID_OBJECT');
  const result = value as Record<string, unknown>;
  if (Object.keys(result).some(k => !allowed.includes(k))) throw new AppError(400, 'UNKNOWN_FIELD');
  return result;
}
export function text(value: unknown, max = 100): string {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f]/.test(value)) throw new AppError(400, 'INVALID_TEXT');
  return value;
}
export function id(value: unknown): string {
  const result = text(value, 64);
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(result)) throw new AppError(400, 'INVALID_ID');
  return result;
}
export function integer(value: unknown, max = 1_000_000_000): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0 || value > max) throw new AppError(400, 'INVALID_INTEGER');
  return value;
}
export function day(value: unknown): string {
  const s = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) throw new AppError(400, 'INVALID_DATE');
  const d = new Date(`${s}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s) throw new AppError(400, 'INVALID_DATE');
  return s;
}
export type Role = 'viewer' | 'editor' | 'owner';
export interface Principal { issuer: string; subject: string }
export interface Query { metrics: string[]; from: string; to: string; groupBy: 'none'|'day'|'workflow' }
export interface Fact {
  recordId: string; day: string; workflow: string; cases: number;
  baselineMinutes: number; humanMinutes: number; runtimeCostVnd: number;
  supportCostVnd: number; cashSavingsVnd: number; cashEvidenceRef: string | null;
}
export interface Snapshot { sourceId: string; observedThrough: string; records: Fact[] }
export function parseSnapshot(value: unknown): Snapshot {
  const v = object(value, ['sourceId', 'observedThrough', 'records']);
  const sourceId = id(v.sourceId); const observedThrough = day(v.observedThrough);
  if (!Array.isArray(v.records) || !v.records.length || v.records.length > 20) throw new AppError(400, 'SNAPSHOT_REQUIRES_1_TO_20_ROWS');
  const seen = new Set<string>(); const grains = new Set<string>();
  const records = v.records.map(raw => {
    const r = object(raw, ['recordId','day','workflow','cases','baselineMinutes','humanMinutes','runtimeCostVnd','supportCostVnd','cashSavingsVnd','cashEvidenceRef']);
    const recordId = id(r.recordId);
    if (seen.has(recordId)) throw new AppError(400, 'DUPLICATE_RECORD');
    seen.add(recordId);
    const recordDay = day(r.day); const workflow = id(r.workflow);
    const grain = `${recordDay}:${workflow}`;
    if (grains.has(grain)) throw new AppError(400, 'DUPLICATE_GRAIN');
    grains.add(grain);
    if (recordDay > observedThrough) throw new AppError(400, 'RECORD_AFTER_SOURCE_WATERMARK');
    const cashSavingsVnd = integer(r.cashSavingsVnd);
    const cashEvidenceRef = r.cashEvidenceRef === null || r.cashEvidenceRef === undefined ? null : id(r.cashEvidenceRef);
    if (cashSavingsVnd > 0 && !cashEvidenceRef) throw new AppError(400, 'CASH_EVIDENCE_REQUIRED');
    return { recordId, day: recordDay, workflow, cases: integer(r.cases, 1_000_000),
      baselineMinutes: integer(r.baselineMinutes, 1_000_000), humanMinutes: integer(r.humanMinutes, 1_000_000),
      runtimeCostVnd: integer(r.runtimeCostVnd), supportCostVnd: integer(r.supportCostVnd), cashSavingsVnd, cashEvidenceRef };
  });
  return { sourceId, observedThrough, records };
}
export async function sha256(value: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}
/** Cash payback is undefined when cash benefit is not positive. Never divide by epsilon. */
export function cashPayback(setupVnd: number, monthlyCashBenefitVnd: number): number | null {
  if (!Number.isFinite(setupVnd) || setupVnd < 0 || !Number.isFinite(monthlyCashBenefitVnd)) throw new AppError(400, 'INVALID_ECONOMICS');
  return monthlyCashBenefitVnd > 0 ? setupVnd / monthlyCashBenefitVnd : null;
}
