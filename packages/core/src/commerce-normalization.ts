import {AppError,id,object,sha256} from './contracts.ts';
import {NORMALIZER_VERSION,normalizeCommerceExport,type SourceScope} from './commerce-model.ts';
import {requireInstallationRole,type InstallationUser} from './installation-auth.ts';
import type {Database,ObjectStore} from './ports.ts';
const primary=(db:Database)=>db.withSession?db.withSession('first-primary'):db;
export function commerceOwner(actor:InstallationUser):void {requireInstallationRole(actor,'owner');}
/** Execution authority for retained-evidence work: either a signed-in owner or
 * the server-owned scheduled runner. There is no fabricated user record for
 * the system path; audit rows record the system identity explicitly. */
export type CommerceAuthority={kind:'owner';actor:InstallationUser}|{kind:'system'};
export function authorityActor(authority:CommerceAuthority):string{return authority.kind==='owner'?authority.actor.id:'system:job-runner';}
export function assertAuthority(authority:CommerceAuthority):void{if(authority.kind==='owner')requireInstallationRole(authority.actor,'owner');}
interface RawReceipt {id:string;connection_id:string;content_hash:string;object_key:string;envelope_json:string;received_at:string;connection_revision:number;state:string}
interface Build {id:string;receipt_id:string;normalizer_version:string;raw_content_hash:string;content_hash:string;state:string;reason_code:string|null;record_count:number;created_at:string}
const buildFields='id,receipt_id,normalizer_version,raw_content_hash,content_hash,state,reason_code,record_count,created_at';
const view=(b:Build)=>({normalizationId:b.id,receiptId:b.receipt_id,normalizerVersion:b.normalizer_version,rawContentHash:b.raw_content_hash,contentHash:b.content_hash,state:b.state,reasonCode:b.reason_code,recordCount:b.record_count,createdAt:b.created_at,published:false,sourceCompletenessCertified:false,liveProviderVerified:false});
/** Bounded synchronous normalization of retained evidence. Caller-supplied
 * job messages never grant authority: scope and state are revalidated here. */
export async function normalizeCommerceReceipt(db:Database,objects:ObjectStore,authority:CommerceAuthority,input:unknown,clock:()=>number=Date.now){
  assertAuthority(authority);const body=object(input,['receiptId']),receiptId=id(body.receiptId),d=primary(db);
  const r=await d.prepare(`SELECT r.* FROM commerce_receipts r
    JOIN commerce_connections c ON c.id=r.connection_id
    WHERE r.id=? AND c.state='active' AND c.revision=r.connection_revision AND r.state!='REVOKED'`)
    .bind(receiptId).first<RawReceipt>();
  if(!r)throw new AppError(403,'RECEIPT_SCOPE_UNAVAILABLE');
  const normalizationId='nb_'+(await sha256(JSON.stringify([receiptId,NORMALIZER_VERSION]))).slice(0,48);
  const prior=await d.prepare(`SELECT ${buildFields} FROM commerce_normalizations WHERE id=?`).bind(normalizationId).first<Build>();
  if(prior)return {...view(prior),replayed:true};
  const scope=JSON.parse(r.envelope_json) as SourceScope&{contentHash:string;objectRef:string};
  const expectedKey=`commerce/raw/${receiptId}/${r.content_hash}.json`;
  if(r.object_key!==expectedKey||scope.objectRef!==expectedKey||scope.contentHash!==r.content_hash)throw new AppError(503,'RAW_EVIDENCE_IDENTITY_MISMATCH');
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
  const written=await d.batch([
    d.prepare(`INSERT INTO commerce_normalizations
      (id,receipt_id,normalizer_version,raw_content_hash,content_hash,state,reason_code,payload_json,record_count,created_at)
      SELECT ?,?,?,?,?,?,?,?,?,? WHERE EXISTS
       (SELECT 1 FROM commerce_receipts r JOIN commerce_connections c ON c.id=r.connection_id
        WHERE r.id=? AND r.state!='REVOKED' AND c.state='active' AND c.revision=r.connection_revision)
      ON CONFLICT(receipt_id,normalizer_version) DO NOTHING`)
      .bind(normalizationId,receiptId,NORMALIZER_VERSION,r.content_hash,hash,state,reason,payload,recordCount,now,receiptId),
    d.prepare(`UPDATE commerce_receipts SET state=?,normalized_revision=?
      WHERE id=? AND EXISTS (SELECT 1 FROM commerce_normalizations WHERE id=?) AND (normalized_revision IS NULL OR normalized_revision!=?)`)
      .bind(state,reason?null:normalizationId,receiptId,normalizationId,normalizationId),
    d.prepare('INSERT INTO audit_events (id,actor,event_type,resource_id,occurred_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),authorityActor(authority),'commerce.'+state.toLowerCase(),receiptId,now)
  ]);
  if(written.some(s=>!s.success))throw new AppError(503,'NORMALIZATION_PERSISTENCE_FAILED');
  const winner=await d.prepare(`SELECT ${buildFields} FROM commerce_normalizations WHERE id=?`).bind(normalizationId).first<Build>();
  if(!winner)throw new AppError(409,'SOURCE_OR_STATE_CHANGED');
  if(winner.content_hash!==hash)throw new AppError(409,'NORMALIZER_VERSION_CONFLICT');
  return {...view(winner),replayed:written[0]?.meta.changes!==1};
}
export async function readCommerceNormalizations(db:Database,actor:InstallationUser,buildId?:string){
  commerceOwner(actor);const d=primary(db);
  const rows=buildId?await d.prepare(`SELECT ${buildFields} FROM commerce_normalizations WHERE id=?`).bind(id(buildId)).all<Build>():await d.prepare(`SELECT ${buildFields} FROM commerce_normalizations ORDER BY created_at DESC,id DESC LIMIT 50`).all<Build>();
  if(buildId&&!rows.results.length)throw new AppError(404,'NORMALIZATION_NOT_FOUND');
  return {normalizations:rows.results.map(view),limit:50};
}
/** Explicit owner-only staging inspection for reviewed cross-source mappings.
 * The default build list remains metadata-only. A build is not a published report. */
export async function readCommerceStaging(db:Database,actor:InstallationUser,normalizationId:string){
 commerceOwner(actor);const row=await primary(db).prepare(`SELECT n.payload_json,n.content_hash,n.normalizer_version FROM commerce_normalizations n
  JOIN commerce_receipts r ON r.id=n.receipt_id
  JOIN commerce_connections c ON c.id=r.connection_id
  WHERE n.id=? AND n.state='NORMALIZED' AND r.state!='REVOKED' AND c.state='active' AND c.revision=r.connection_revision`)
  .bind(id(normalizationId)).first<{payload_json:string;content_hash:string;normalizer_version:string}>();
 if(!row)throw new AppError(404,'STAGING_SCOPE_UNAVAILABLE');
 if(row.normalizer_version!==NORMALIZER_VERSION||new TextEncoder().encode(row.payload_json).byteLength>512_000||await sha256(row.payload_json)!==row.content_hash)throw new AppError(503,'NORMALIZATION_INTEGRITY');
 return {normalizationId,contentHash:row.content_hash,data:JSON.parse(row.payload_json),published:false};
}
