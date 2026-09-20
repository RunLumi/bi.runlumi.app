import { AppError, sha256, type Snapshot } from '../../../packages/core/contracts.ts';
import type { Env } from './bindings.ts';
import { requireOwner, type TenantContext } from './tenant.ts';
export async function importSnapshot(env: Env, ctx: TenantContext, snapshot: Snapshot, key: string) {
  requireOwner(ctx);
  if (!/^[A-Za-z0-9_-]{8,80}$/.test(key)) throw new AppError(400,'INVALID_IDEMPOTENCY_KEY');
  const source = await ctx.db.prepare("SELECT id FROM sources WHERE tenant_id=? AND id=? AND state='active'").bind(ctx.id,snapshot.sourceId).first();
  if (!source) throw new AppError(400,'SOURCE_NOT_REGISTERED');
  const hash = await sha256(JSON.stringify(snapshot));
  const existing = async () => ctx.db.prepare('SELECT id,content_hash FROM snapshots WHERE tenant_id=? AND idempotency_key=?').bind(ctx.id,key).first<{id:string;content_hash:string}>();
  const replay = (r: {id:string;content_hash:string}) => {
    if (r.content_hash !== hash) throw new AppError(409,'IDEMPOTENCY_CONFLICT');
    return {snapshotId:r.id,replayed:true};
  };
  const prior = await existing(); if (prior) return replay(prior);
  const current = async () => ctx.db.prepare('SELECT s.observed_through FROM snapshots s JOIN active_snapshots a ON a.tenant_id=s.tenant_id AND a.snapshot_id=s.id WHERE a.tenant_id=? AND a.source_id=?')
    .bind(ctx.id,snapshot.sourceId).first<{observed_through:string}>();
  const active = await current();
  if (active && snapshot.observedThrough < active.observed_through) throw new AppError(409,'STALE_SNAPSHOT');
  const snapshotId = (await sha256(`${ctx.id}:${key}:${hash}`)).slice(0,40);
  const objectKey = `tenants/${ctx.id}/sources/${snapshot.sourceId}/snapshots/${snapshotId}.json`;
  // R2 and D1 do not share a transaction. A failure can leave an unreferenced R2 object,
  // never a half-published dataset. Lifecycle cleanup must not delete referenced evidence.
  await env.SOURCES.put(objectKey,JSON.stringify(snapshot),{httpMetadata:{contentType:'application/json'}});
  const now = new Date().toISOString();
  const statements = [ctx.db.prepare('INSERT INTO snapshots (id,tenant_id,source_id,idempotency_key,content_hash,object_key,observed_through,ingested_at,record_count) VALUES (?,?,?,?,?,?,?,?,?)')
    .bind(snapshotId,ctx.id,snapshot.sourceId,key,hash,objectKey,snapshot.observedThrough,now,snapshot.records.length)];
  for (const r of snapshot.records) statements.push(ctx.db.prepare('INSERT INTO workflow_facts (tenant_id,snapshot_id,record_id,business_day,workflow,cases,baseline_minutes,human_minutes,runtime_cost_vnd,support_cost_vnd,cash_savings_vnd,cash_evidence_ref) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
    .bind(ctx.id,snapshotId,r.recordId,r.day,r.workflow,r.cases,r.baselineMinutes,r.humanMinutes,r.runtimeCostVnd,r.supportCostVnd,r.cashSavingsVnd,r.cashEvidenceRef));
  statements.push(ctx.db.prepare('INSERT INTO active_snapshots (tenant_id,source_id,snapshot_id) VALUES (?,?,?) ON CONFLICT(tenant_id,source_id) DO UPDATE SET snapshot_id=excluded.snapshot_id').bind(ctx.id,snapshot.sourceId,snapshotId));
  statements.push(ctx.db.prepare('INSERT INTO audit_events (id,tenant_id,actor,event_type,resource_id,occurred_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),ctx.id,ctx.principal.subject,'snapshot.published',snapshotId,now));
  try { await ctx.db.batch(statements); } catch (error) {
    const concurrent = await existing(); if (concurrent) return replay(concurrent);
    const latest = await current();
    if (latest && snapshot.observedThrough < latest.observed_through) throw new AppError(409,'STALE_SNAPSHOT');
    throw error;
  }
  return {snapshotId,replayed:false};
}
