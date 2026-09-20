import {AppError,id,object,sha256} from './contracts.ts';
import {NORMALIZER_VERSION,normalizeCommerceExport,type SourceScope} from './commerce-model.ts';
import {requireOwner,type TenantContext} from './tenant.ts';
import type {Database,ObjectStore} from './ports.ts';
const primary=(db:Database)=>db.withSession?db.withSession('first-primary'):db;
export function commerceOwner(ctx:TenantContext):void {
  requireOwner(ctx);if(!ctx.features.includes('data.import'))throw new AppError(403,'ENTITLEMENT_REQUIRED');
}
interface RawReceipt {id:string;connection_id:string;content_hash:string;object_key:string;envelope_json:string;received_at:string;route_epoch:number;connection_revision:number;state:string}
interface Build {id:string;receipt_id:string;normalizer_version:string;raw_content_hash:string;content_hash:string;state:string;reason_code:string|null;record_count:number;created_at:string}
const buildFields='id,receipt_id,normalizer_version,raw_content_hash,content_hash,state,reason_code,record_count,created_at';
const view=(b:Build)=>({normalizationId:b.id,receiptId:b.receipt_id,normalizerVersion:b.normalizer_version,rawContentHash:b.raw_content_hash,contentHash:b.content_hash,state:b.state,reasonCode:b.reason_code,recordCount:b.record_count,createdAt:b.created_at,published:false,sourceCompletenessCertified:false,liveProviderVerified:false});
/** Bounded synchronous consumer of retained evidence. Queue messages never grant authority. */
export async function normalizeCommerceReceipt(ctx:TenantContext,objects:ObjectStore,input:unknown,clock:()=>number=Date.now){
  commerceOwner(ctx);const body=object(input,['receiptId']),receiptId=id(body.receiptId),db=primary(ctx.db);
  const r=await db.prepare(`SELECT r.* FROM commerce_receipts r
    JOIN commerce_connections c ON c.tenant_id=r.tenant_id AND c.id=r.connection_id
    JOIN tenant_identity t ON t.tenant_id=r.tenant_id
    WHERE r.tenant_id=? AND r.id=? AND c.state='active' AND c.revision=r.connection_revision
      AND t.route_epoch=? AND r.route_epoch=t.route_epoch AND r.state!='REVOKED'`)
    .bind(ctx.id,receiptId,ctx.routeEpoch).first<RawReceipt>();
  if(!r)throw new AppError(403,'RECEIPT_SCOPE_UNAVAILABLE');
  const normalizationId='nb_'+(await sha256(JSON.stringify([ctx.id,receiptId,NORMALIZER_VERSION]))).slice(0,48);
  const prior=await db.prepare(`SELECT ${buildFields} FROM commerce_normalizations WHERE tenant_id=? AND id=?`).bind(ctx.id,normalizationId).first<Build>();
  if(prior)return {...view(prior),replayed:true};
  const scope=JSON.parse(r.envelope_json) as SourceScope&{contentHash:string;objectRef:string};
  const expectedKey=`tenants/${ctx.id}/commerce/raw/${receiptId}/${r.content_hash}.json`;
  if(scope.tenantId!==ctx.id||r.object_key!==expectedKey||scope.objectRef!==expectedKey||scope.contentHash!==r.content_hash)throw new AppError(503,'RAW_EVIDENCE_IDENTITY_MISMATCH');
  const source=await objects.get(expectedKey);if(!source)throw new AppError(503,'RAW_EVIDENCE_UNAVAILABLE');
  if(source.size!==undefined&&source.size>48_000)throw new AppError(503,'RAW_EVIDENCE_INTEGRITY');
  const raw=await source.text();
  if(new TextEncoder().encode(raw).byteLength>48_000||await sha256(raw)!==r.content_hash)throw new AppError(503,'RAW_EVIDENCE_INTEGRITY');
  let payload:string|null=null,reason:string|null=null,recordCount=0;
  try {
    const normalized=await normalizeCommerceExport(JSON.parse(raw),scope);
    if(Date.parse(normalized.observedAt)>Date.parse(r.received_at)+300_000)throw new AppError(422,'FUTURE_EXPORT_OBSERVATION');
    payload=JSON.stringify(normalized);recordCount=normalized.orders.length+normalized.settlements.length+normalized.inventory.length;
  } catch(error) {
    // Stable reason codes only. Do not copy raw row values/driver errors into diagnostics.
    if(error instanceof AppError&&error.status>=400&&error.status<500)reason=error.code;
    else if(error instanceof SyntaxError)reason='INVALID_RETAINED_JSON';
    else throw error;
  }
  const state=reason?'QUARANTINED':'NORMALIZED',hash=await sha256(payload??JSON.stringify({normalizer:NORMALIZER_VERSION,reason})),now=new Date(clock()).toISOString();
  const written=await db.batch([
    db.prepare(`INSERT INTO commerce_normalizations
      (tenant_id,id,receipt_id,normalizer_version,raw_content_hash,content_hash,state,reason_code,payload_json,record_count,created_at)
      SELECT ?,?,?,?,?,?,?,?,?,?,? WHERE EXISTS
       (SELECT 1 FROM commerce_receipts r JOIN commerce_connections c ON c.tenant_id=r.tenant_id AND c.id=r.connection_id
        JOIN tenant_identity t ON t.tenant_id=r.tenant_id
        WHERE r.tenant_id=? AND r.id=? AND r.state!='REVOKED' AND c.state='active' AND c.revision=r.connection_revision
          AND t.route_epoch=? AND r.route_epoch=t.route_epoch)
      ON CONFLICT(tenant_id,receipt_id,normalizer_version) DO NOTHING`)
      .bind(ctx.id,normalizationId,receiptId,NORMALIZER_VERSION,r.content_hash,hash,state,reason,payload,recordCount,now,ctx.id,receiptId,ctx.routeEpoch),
    db.prepare(`UPDATE commerce_receipts SET state=?,normalized_revision=?
      WHERE tenant_id=? AND id=? AND EXISTS (SELECT 1 FROM commerce_normalizations WHERE tenant_id=? AND id=?)
      AND changes()=1 AND (normalized_revision IS NULL OR normalized_revision!=?)`)
      .bind(state,reason?null:normalizationId,ctx.id,receiptId,ctx.id,normalizationId,normalizationId),
    db.prepare(`INSERT INTO audit_events (id,tenant_id,actor,event_type,resource_id,occurred_at)
      SELECT ?,?,?,?,?,? WHERE changes()=1`).bind(crypto.randomUUID(),ctx.id,ctx.principal.subject,'commerce.'+state.toLowerCase(),receiptId,now)
  ]);
  if(written.some(s=>!s.success))throw new AppError(503,'NORMALIZATION_PERSISTENCE_FAILED');
  const winner=await db.prepare(`SELECT ${buildFields} FROM commerce_normalizations WHERE tenant_id=? AND id=?`).bind(ctx.id,normalizationId).first<Build>();
  if(!winner)throw new AppError(409,'SOURCE_OR_ROUTE_CHANGED');
  if(winner.content_hash!==hash)throw new AppError(409,'NORMALIZER_VERSION_CONFLICT');
  return {...view(winner),replayed:written[0]?.meta.changes!==1};
}
export async function readCommerceNormalizations(ctx:TenantContext,buildId?:string){
  commerceOwner(ctx);const db=primary(ctx.db);
  const rows=buildId?await db.prepare(`SELECT ${buildFields} FROM commerce_normalizations WHERE tenant_id=? AND id=?`).bind(ctx.id,id(buildId)).all<Build>():await db.prepare(`SELECT ${buildFields} FROM commerce_normalizations WHERE tenant_id=? ORDER BY created_at DESC,id DESC LIMIT 50`).bind(ctx.id).all<Build>();
  if(buildId&&!rows.results.length)throw new AppError(404,'NORMALIZATION_NOT_FOUND');
  return {normalizations:rows.results.map(view),limit:50};
}
/** Explicit owner-only staging inspection for reviewed cross-source mappings.
 * The default build list remains metadata-only. A build is not a published report.
 */
export async function readCommerceStaging(ctx:TenantContext,normalizationId:string){
 commerceOwner(ctx);const row=await primary(ctx.db).prepare(`SELECT n.payload_json,n.content_hash,n.normalizer_version FROM commerce_normalizations n
  JOIN commerce_receipts r ON r.tenant_id=n.tenant_id AND r.id=n.receipt_id
  JOIN commerce_connections c ON c.tenant_id=r.tenant_id AND c.id=r.connection_id
  JOIN tenant_identity t ON t.tenant_id=n.tenant_id
  WHERE n.tenant_id=? AND n.id=? AND n.state='NORMALIZED' AND r.state!='REVOKED'
   AND c.state='active' AND c.revision=r.connection_revision AND t.route_epoch=? AND r.route_epoch=t.route_epoch`)
  .bind(ctx.id,id(normalizationId),ctx.routeEpoch).first<{payload_json:string;content_hash:string;normalizer_version:string}>();
 if(!row)throw new AppError(404,'STAGING_SCOPE_UNAVAILABLE');
 if(row.normalizer_version!==NORMALIZER_VERSION||new TextEncoder().encode(row.payload_json).byteLength>512_000||await sha256(row.payload_json)!==row.content_hash)throw new AppError(503,'NORMALIZATION_INTEGRITY');
 const data=JSON.parse(row.payload_json) as {tenantId:string};if(data.tenantId!==ctx.id)throw new AppError(503,'NORMALIZATION_IDENTITY_MISMATCH');
 return {normalizationId,contentHash:row.content_hash,data,published:false};
}
