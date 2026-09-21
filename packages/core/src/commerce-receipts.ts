import {AppError,id,sha256} from './contracts.ts';
import {parseExportEnvelope} from './commerce-envelope.ts';
import {requireInstallationRole,type InstallationUser} from './installation-auth.ts';
import type {Database,ObjectStore} from './ports.ts';

interface Connection {provider:string;source_account_id:string;resource_type:string;transport:string;approval_ref:string;state:string;revision:number}
interface Receipt {id:string;connection_id:string;fingerprint:string;content_hash:string;state:string;received_at:string;normalized_revision:string|null;published_version:string|null}
const primary=(db:Database)=>db.withSession?db.withSession('first-primary'):db;
const receiptSql='SELECT id,connection_id,fingerprint,content_hash,state,received_at,normalized_revision,published_version FROM commerce_receipts WHERE id=?';
const receiptOwner=(actor:InstallationUser)=>requireInstallationRole(actor,'owner');
function view(r:Receipt){return {receiptId:r.id,connectionId:r.connection_id,contentHash:r.content_hash,state:r.state,receivedAt:r.received_at,normalizedRevision:r.normalized_revision,publishedVersion:r.published_version,sourceCompletenessCertified:false,liveProviderVerified:false};}

/** Successful return means raw bytes + receipt row, NOT published facts.
 * Delivery identity and raw bytes are deduplicated; conflicting bytes under a
 * used delivery ID fail with 409 and never rewrite retained evidence. */
export async function acceptCommerceExport(db:Database,objects:ObjectStore,actor:InstallationUser,input:unknown,clock:()=>number=Date.now){
 receiptOwner(actor);const b=parseExportEnvelope(input);const d=primary(db);
 const c=await d.prepare('SELECT provider,source_account_id,resource_type,transport,approval_ref,state,revision FROM commerce_connections WHERE id=?').bind(b.connectionId).first<Connection>();
 if(!c)throw new AppError(404,'CONNECTION_NOT_FOUND');
 if(c.state!=='active'||c.transport!=='authorized-export')throw new AppError(403,'CONNECTION_NOT_ACTIVE');
 if(c.source_account_id!==b.sourceAccountId||c.resource_type!==b.resourceType)throw new AppError(403,'SOURCE_SCOPE_MISMATCH');
 const receiptId='cr_'+(await sha256(JSON.stringify([b.connectionId,b.deliveryId]))).slice(0,48);
 const contentHash=await sha256(b.rawJson);
 const objectKey=`commerce/raw/${receiptId}/${contentHash}.json`;
 const {rawJson,...metadata}=b;
 const envelope={...metadata,provider:c.provider,transport:c.transport,authorizationCoverageRef:c.approval_ref,adapterVersion:'authorized-export-v1',sourceCursor:null,contentHash,objectRef:objectKey};
 const serialized=JSON.stringify(envelope),fingerprint=await sha256(serialized);
 const prior=await d.prepare(receiptSql).bind(receiptId).first<Receipt>();
 if(prior){if(prior.fingerprint!==fingerprint)throw new AppError(409,'DELIVERY_ID_CONFLICT');return {...view(prior),replayed:true};}
 // Deterministic put: a crash before D1 leaves a recoverable orphan. Retry adopts this key.
 await objects.put(objectKey,rawJson,{httpMetadata:{contentType:'application/json'}});
 const now=new Date(clock()).toISOString();
 const written=await d.batch([
  d.prepare(`INSERT INTO commerce_receipts
   (id,connection_id,delivery_id,fingerprint,content_hash,object_key,envelope_json,state,received_at,connection_revision)
   SELECT ?,?,?,?,?,?,?, 'ACCEPTED',?,? WHERE EXISTS
    (SELECT 1 FROM commerce_connections WHERE id=? AND state='active' AND revision=?)
   ON CONFLICT(connection_id,delivery_id) DO NOTHING`)
   .bind(receiptId,b.connectionId,b.deliveryId,fingerprint,contentHash,objectKey,serialized,now,c.revision,b.connectionId,c.revision)
 ]);
 if(written.length!==1||written.some(r=>!r.success))throw new AppError(503,'RECEIPT_PERSISTENCE_FAILED');
 const winner=await d.prepare(receiptSql).bind(receiptId).first<Receipt>();
 if(!winner)throw new AppError(409,'SOURCE_OR_STATE_CHANGED');
 if(winner.fingerprint!==fingerprint)throw new AppError(409,'DELIVERY_ID_CONFLICT');
 return {...view(winner),replayed:written[0]?.meta.changes!==1};
}

/** Owner-only metadata. No raw bytes, object URLs, credentials or business rows. */
export async function readCommerceReceipts(db:Database,actor:InstallationUser,receiptId?:string){
 receiptOwner(actor);const d=primary(db);
 if(receiptId){const r=await d.prepare(receiptSql).bind(id(receiptId)).first<Receipt>();if(!r)throw new AppError(404,'RECEIPT_NOT_FOUND');return {receipts:[view(r)]};}
 const rows=await d.prepare('SELECT id,connection_id,fingerprint,content_hash,state,received_at,normalized_revision,published_version FROM commerce_receipts ORDER BY received_at DESC,id DESC LIMIT 50').all<Receipt>();
 return {receipts:rows.results.map(view),limit:50};
}
