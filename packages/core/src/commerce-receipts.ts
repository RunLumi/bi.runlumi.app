import {AppError,id,sha256} from './contracts.ts';
import {parseExportEnvelope} from './commerce-envelope.ts';
import {requireOwner,type TenantContext} from './tenant.ts';
import type {Database,ObjectStore} from './ports.ts';

interface Connection {provider:string;source_account_id:string;resource_type:string;transport:string;approval_ref:string;state:string;revision:number}
interface Receipt {id:string;connection_id:string;fingerprint:string;content_hash:string;state:string;received_at:string;normalized_revision:string|null;published_version:string|null}
const primary=(db:Database)=>db.withSession?db.withSession('first-primary'):db;
const receiptSql='SELECT id,connection_id,fingerprint,content_hash,state,received_at,normalized_revision,published_version FROM commerce_receipts WHERE tenant_id=? AND id=?';
function owner(ctx:TenantContext):void {requireOwner(ctx);if(!ctx.features.includes('data.import'))throw new AppError(403,'ENTITLEMENT_REQUIRED');}
function view(r:Receipt){return {receiptId:r.id,connectionId:r.connection_id,contentHash:r.content_hash,state:r.state,receivedAt:r.received_at,normalizedRevision:r.normalized_revision,publishedVersion:r.published_version,sourceCompletenessCertified:false,liveProviderVerified:false};}

/** C06-R02. Successful return means raw bytes + receipt/outbox, NOT published facts. */
export async function acceptCommerceExport(ctx:TenantContext,objects:ObjectStore,input:unknown,clock:()=>number=Date.now){
 owner(ctx);const b=parseExportEnvelope(input);const db=primary(ctx.db);
 const c=await db.prepare('SELECT provider,source_account_id,resource_type,transport,approval_ref,state,revision FROM commerce_connections WHERE tenant_id=? AND id=?').bind(ctx.id,b.connectionId).first<Connection>();
 if(!c)throw new AppError(404,'CONNECTION_NOT_FOUND');
 if(c.state!=='active'||c.transport!=='authorized-export')throw new AppError(403,'CONNECTION_NOT_ACTIVE');
 if(c.source_account_id!==b.sourceAccountId||c.resource_type!==b.resourceType)throw new AppError(403,'SOURCE_SCOPE_MISMATCH');
 const receiptId='cr_'+(await sha256(JSON.stringify([ctx.id,b.connectionId,b.deliveryId]))).slice(0,48);
 const contentHash=await sha256(b.rawJson);
 const objectKey=`tenants/${ctx.id}/commerce/raw/${receiptId}/${contentHash}.json`;
 const {rawJson,...metadata}=b;
 const envelope={...metadata,tenantId:ctx.id,provider:c.provider,transport:c.transport,authorizationCoverageRef:c.approval_ref,adapterVersion:'authorized-export-v1',sourceCursor:null,contentHash,objectRef:objectKey};
 const serialized=JSON.stringify(envelope),fingerprint=await sha256(serialized);
 const prior=await db.prepare(receiptSql).bind(ctx.id,receiptId).first<Receipt>();
 if(prior){if(prior.fingerprint!==fingerprint)throw new AppError(409,'DELIVERY_ID_CONFLICT');return {...view(prior),replayed:true};}
 // Deterministic put: a crash before D1 leaves a recoverable orphan. Retry adopts this key.
 await objects.put(objectKey,rawJson,{httpMetadata:{contentType:'application/json'}});
 const now=new Date(clock()).toISOString();
 const written=await db.batch([
  db.prepare(`INSERT INTO commerce_receipts
   (tenant_id,id,connection_id,delivery_id,fingerprint,content_hash,object_key,envelope_json,state,received_at,route_epoch,connection_revision)
   SELECT ?,?,?,?,?,?,?,?,'ACCEPTED',?,?,? WHERE EXISTS
    (SELECT 1 FROM commerce_connections c JOIN tenant_identity t ON t.tenant_id=c.tenant_id
     WHERE c.tenant_id=? AND c.id=? AND c.state='active' AND c.revision=? AND t.route_epoch=?)
   ON CONFLICT(tenant_id,connection_id,delivery_id) DO NOTHING`)
   .bind(ctx.id,receiptId,b.connectionId,b.deliveryId,fingerprint,contentHash,objectKey,serialized,now,ctx.routeEpoch,c.revision,ctx.id,b.connectionId,c.revision,ctx.routeEpoch),
  db.prepare("INSERT INTO commerce_outbox (tenant_id,receipt_id,state,created_at) SELECT ?,?,'PENDING',? WHERE changes()=1")
   .bind(ctx.id,receiptId,now)
 ]);
 if(written.length!==2||written.some(r=>!r.success))throw new AppError(503,'RECEIPT_PERSISTENCE_FAILED');
 const winner=await db.prepare(receiptSql).bind(ctx.id,receiptId).first<Receipt>();
 if(!winner)throw new AppError(409,'SOURCE_OR_ROUTE_CHANGED');
 if(winner.fingerprint!==fingerprint)throw new AppError(409,'DELIVERY_ID_CONFLICT');
 return {...view(winner),replayed:written[0]?.meta.changes!==1};
}

/** Owner-only metadata. No raw bytes, object URLs, credentials or business rows. */
export async function readCommerceReceipts(ctx:TenantContext,receiptId?:string){
 owner(ctx);const db=primary(ctx.db);
 if(receiptId){const r=await db.prepare(receiptSql).bind(ctx.id,id(receiptId)).first<Receipt>();if(!r)throw new AppError(404,'RECEIPT_NOT_FOUND');return {receipts:[view(r)]};}
 const rows=await db.prepare('SELECT id,connection_id,fingerprint,content_hash,state,received_at,normalized_revision,published_version FROM commerce_receipts WHERE tenant_id=? ORDER BY received_at DESC,id DESC LIMIT 50').bind(ctx.id).all<Receipt>();
 return {receipts:rows.results.map(view),limit:50};
}

export interface ReceiptMessage {tenantId:string;connectionId:string;receiptId:string}
/** At-least-once dispatch adapter; no deployed Queue/cron or consumer is implied.
 * Send succeeds before marking dispatched. Crash in between can resend the same receipt.
 * A consumer MUST revalidate scope/state and dedupe on receipt ID before processing.
 */
export async function dispatchCommerceOutbox(ctx:TenantContext,send:(message:ReceiptMessage)=>Promise<void>,limit=20){
 owner(ctx);if(!Number.isInteger(limit)||limit<1||limit>50)throw new AppError(400,'OUTBOX_LIMIT');
 const db=primary(ctx.db);const rows=await db.prepare(`SELECT r.id,r.connection_id FROM commerce_outbox o
  JOIN commerce_receipts r ON r.tenant_id=o.tenant_id AND r.id=o.receipt_id
  JOIN commerce_connections c ON c.tenant_id=r.tenant_id AND c.id=r.connection_id
  JOIN tenant_identity t ON t.tenant_id=r.tenant_id
  WHERE o.tenant_id=? AND o.state='PENDING' AND r.state='ACCEPTED'
   AND c.state='active' AND c.revision=r.connection_revision AND t.route_epoch=? AND r.route_epoch=t.route_epoch
  ORDER BY o.created_at,o.receipt_id LIMIT ?`).bind(ctx.id,ctx.routeEpoch,limit).all<{id:string;connection_id:string}>();
 let dispatched=0,retryPending=0;
 for(const row of rows.results){
  const admitted=await db.prepare(`UPDATE commerce_outbox SET attempts=attempts+1
   WHERE tenant_id=? AND receipt_id=? AND state='PENDING' AND EXISTS
    (SELECT 1 FROM commerce_receipts r JOIN commerce_connections c ON c.tenant_id=r.tenant_id AND c.id=r.connection_id
     JOIN tenant_identity t ON t.tenant_id=r.tenant_id
     WHERE r.tenant_id=? AND r.id=? AND r.state='ACCEPTED' AND c.state='active'
      AND c.revision=r.connection_revision AND t.route_epoch=? AND r.route_epoch=t.route_epoch)`)
   .bind(ctx.id,row.id,ctx.id,row.id,ctx.routeEpoch).run();
  if(admitted.meta.changes!==1)continue;
  try{await send({tenantId:ctx.id,connectionId:row.connection_id,receiptId:row.id});}
  catch{retryPending++;continue;}
  // Do not catch DB failure after successful send: retry may resend; never pretend atomicity.
  await db.prepare("UPDATE commerce_outbox SET state='DISPATCHED',dispatched_at=? WHERE tenant_id=? AND receipt_id=? AND state='PENDING'").bind(new Date().toISOString(),ctx.id,row.id).run();dispatched++;
 }
 return {dispatched,retryPending};
}
