import { AppError, type Principal, type Role } from '../../../packages/core/contracts.ts';
import type { Database, Env } from './bindings.ts';
export interface TenantContext { id: string; role: Role; db: Database; principal: Principal }
export async function authorizeTenant(env: Env, principal: Principal, tenantId: string): Promise<TenantContext> {
  const row = await env.CONTROL_DB.prepare(`SELECT t.id,t.binding_name,t.cell_id,m.role FROM tenants t JOIN memberships m ON m.tenant_id=t.id WHERE t.id=? AND t.state='active' AND m.issuer=? AND m.subject=? AND m.state='active'`)
    .bind(tenantId, principal.issuer, principal.subject).first<{id:string;binding_name:string;cell_id:string;role:Role}>();
  // Return same status for unknown tenant and denied tenant. Never read tenant DB first.
  if (!row) throw new AppError(403, 'TENANT_ACCESS_DENIED');
  const bindings: unknown = JSON.parse(env.TENANT_BINDINGS);
  if (!Array.isArray(bindings) || !bindings.every(x => typeof x === 'string' && /^TENANT_[A-Z0-9_]+$/.test(x)) || !bindings.includes(row.binding_name) || row.cell_id !== env.CELL_ID) throw new AppError(503,'TENANT_ROUTING_UNAVAILABLE');
  const db = env[row.binding_name] as Database | undefined;
  if (!db || typeof db.prepare !== 'function') throw new AppError(503,'TENANT_ROUTING_UNAVAILABLE');
  const identity = await db.prepare('SELECT tenant_id FROM tenant_identity WHERE singleton=1').first<{tenant_id:string}>();
  if (!identity || identity.tenant_id !== tenantId) throw new AppError(503,'TENANT_IDENTITY_MISMATCH');
  if (!['viewer','editor','owner'].includes(row.role)) throw new AppError(403,'ROLE_DENIED');
  return {id:tenantId,role:row.role,db,principal};
}
export function canEdit(ctx: TenantContext): void {
  if (ctx.role !== 'editor' && ctx.role !== 'owner') throw new AppError(403,'EDITOR_REQUIRED');
}
export function requireOwner(ctx: TenantContext): void {
  if (ctx.role !== 'owner') throw new AppError(403,'OWNER_REQUIRED');
}
