import {AppError,id,integer,object,sha256,text} from './contracts.ts';
import {NORMALIZER_VERSION,type NormalizedExport} from './commerce-model.ts';
import {assembleCommerceReport,parseIdentityMapping,parseSourceControls,type CommerceReport,type IdentityMapping} from './commerce-report.ts';
import {commerceOwner} from './commerce-normalization.ts';
import type {InstallationUser} from './installation-auth.ts';
import type {Database} from './ports.ts';
const database=(db:Database)=>db.withSession?db.withSession('first-primary'):db;
interface Head {active_publication_id:string|null;revision:number}
interface StoredReport {id:string;mapping_id:string|null;content_hash:string;report_json:string;created_at:string}
interface InputRow {id:string;receipt_id:string;connection_id:string;content_hash:string;raw_content_hash:string;payload_json:string}
const currentInputs=`SELECT n.id,n.receipt_id,r.connection_id,n.content_hash,n.raw_content_hash,n.payload_json FROM commerce_normalizations n
 JOIN commerce_receipts r ON r.id=n.receipt_id
 JOIN commerce_connections c ON c.id=r.connection_id
 WHERE n.id IN (SELECT value FROM json_each(?)) AND n.state='NORMALIZED' AND n.normalizer_version=?
  AND r.state!='REVOKED' AND c.state='active' AND c.revision=r.connection_revision`;
function parseCandidate(value:unknown){
 const b=object(value,['normalizationIds','mappingId','controls','expectedRevision','expectedPublicationId','previewHash','reason']);
 if(!Array.isArray(b.normalizationIds)||!b.normalizationIds.length||b.normalizationIds.length>10)throw new AppError(422,'PUBLICATION_INPUT_LIMIT');
 const ids=b.normalizationIds.map(id).sort();if(new Set(ids).size!==ids.length)throw new AppError(422,'DUPLICATE_PUBLICATION_INPUT');
 return {ids,mappingId:b.mappingId===null?null:id(b.mappingId),controls:parseSourceControls(b.controls),expectedRevision:integer(b.expectedRevision),expectedPublicationId:b.expectedPublicationId===null?null:id(b.expectedPublicationId),previewHash:b.previewHash,reason:b.reason};
}
export async function registerCommerceMapping(db:Database,actor:InstallationUser,input:unknown){
 commerceOwner(actor);const mapping=parseIdentityMapping(input),payload=JSON.stringify(mapping),hash=await sha256(payload),mappingId='cm_'+hash.slice(0,48),d=database(db),now=new Date().toISOString();
 if(new TextEncoder().encode(payload).byteLength>48_000)throw new AppError(422,'MAPPING_LIMIT');
 const result=await d.batch([
  d.prepare('INSERT INTO commerce_mappings (id,content_hash,payload_json,created_at,actor) SELECT ?,?,?,?,?,? ON CONFLICT(id) DO NOTHING').bind(mappingId,hash,payload,now,actor.id),
  d.prepare('INSERT INTO audit_events (id,actor,event_type,resource_id,occurred_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),actor.id,'commerce.mapping-reviewed',mappingId,now)
 ]);
 const found=await d.prepare('SELECT content_hash FROM commerce_mappings WHERE id=?').bind(mappingId).first<{content_hash:string}>();
 if(!found)throw new AppError(503,'MAPPING_INTEGRITY');if(found.content_hash!==hash)throw new AppError(503,'MAPPING_INTEGRITY');
 return {mappingId,contentHash:hash,replayed:result[0]?.meta.changes!==1,provenance:'owner-reviewed',attestationVerified:false};
}
async function storedReport(row:StoredReport):Promise<CommerceReport>{
 if(new TextEncoder().encode(row.report_json).byteLength>512_000||await sha256(row.report_json)!==row.content_hash)throw new AppError(503,'PUBLICATION_INTEGRITY');
 const report=JSON.parse(row.report_json) as CommerceReport;
 if(report.contract!=='lumi.commerce.report.v1')throw new AppError(503,'UNSUPPORTED_REPORT_VERSION');return report;
}
async function candidate(db:Database,actor:InstallationUser,input:unknown){
 commerceOwner(actor);const b=parseCandidate(input),d=database(db);
 const rows=await d.batch([
  d.prepare(currentInputs).bind(JSON.stringify(b.ids),NORMALIZER_VERSION),
  d.prepare('SELECT active_publication_id,revision FROM commerce_heads WHERE singleton=1'),
  d.prepare('SELECT p.* FROM commerce_publications p JOIN commerce_heads h ON h.active_publication_id=p.id'),
  d.prepare('SELECT payload_json,content_hash FROM commerce_mappings WHERE id=?').bind(b.mappingId)
 ]);
 if(rows.some(r=>!r.success)||rows[0]!.results.length!==b.ids.length)throw new AppError(409,'NORMALIZATION_SCOPE_CHANGED');
 let mapping:IdentityMapping|null=null;
 if(b.mappingId!==null){const r=rows[3]!.results[0];if(!r||typeof r.payload_json!=='string'||new TextEncoder().encode(r.payload_json).byteLength>48_000||await sha256(r.payload_json)!==r.content_hash)throw new AppError(503,'MAPPING_INTEGRITY');mapping=parseIdentityMapping(JSON.parse(r.payload_json));}
 const inputs=[];
  for(const raw of rows[0]!.results){const r=raw as unknown as InputRow;if(await sha256(r.payload_json)!==r.content_hash)throw new AppError(503,'NORMALIZATION_INTEGRITY');const data=JSON.parse(r.payload_json) as NormalizedExport;if(data.normalizerVersion!==NORMALIZER_VERSION)throw new AppError(503,'NORMALIZATION_IDENTITY_MISMATCH');inputs.push({normalizationId:r.id,receiptId:r.receipt_id,contentHash:r.content_hash,rawContentHash:r.raw_content_hash,connectionId:r.connection_id,data});}
 inputs.sort((a,b)=>a.normalizationId<b.normalizationId?-1:1);
  const report=assembleCommerceReport(inputs,mapping,b.controls);
  report.warnings=[...new Set(report.warnings)];
  const serialized=JSON.stringify(report);
 if(new TextEncoder().encode(serialized).byteLength>512_000)throw new AppError(422,'PUBLICATION_BUDGET_EXCEEDED');
 const hash=await sha256(serialized),previewHash=await sha256(JSON.stringify([b.ids,b.mappingId,b.controls,b.expectedRevision,b.expectedPublicationId,hash])),publicationId='cp_'+previewHash.slice(0,48);
 const head=(rows[1]!.results[0] as unknown as Head|undefined)??{active_publication_id:null,revision:0};
 const replayed=head.active_publication_id===publicationId&&head.revision===b.expectedRevision+1;
 if(!replayed&&(head.active_publication_id!==b.expectedPublicationId||head.revision!==b.expectedRevision))throw new AppError(409,'PUBLICATION_REVISION_CONFLICT');
 if(!replayed&&rows[2]!.results[0]){
  const previous=await storedReport(rows[2]!.results[0] as unknown as StoredReport);
  if(report.window.toExclusive<previous.window.toExclusive)throw new AppError(409,'PUBLICATION_WATERMARK_REGRESSION');
  for(const old of previous.sources){
   const next=report.sources.find(n=>n.provider===old.provider&&n.sourceAccountId===old.sourceAccountId&&n.resourceType===old.resourceType);
   if(!next)throw new AppError(409,'PUBLICATION_SOURCE_OMISSION');
   if(next.observedAt<old.observedAt||next.observedAt===old.observedAt&&next.contentHash!==old.contentHash)throw new AppError(409,'SOURCE_OBSERVATION_REGRESSION');
  }
 }
 return {b,db:d,report,serialized,hash,previewHash,publicationId,head,replayed};
}
export async function previewCommercePublication(db:Database,actor:InstallationUser,input:unknown){
 const c=await candidate(db,actor,input);return {publicationId:c.publicationId,previewHash:c.previewHash,report:c.report,expectedRevision:c.b.expectedRevision,published:false};
}
export async function publishCommerce(db:Database,actor:InstallationUser,input:unknown){
 const c=await candidate(db,actor,input),{b,db:d}=c;
 if(b.previewHash!==c.previewHash)throw new AppError(409,'PUBLICATION_PREVIEW_REQUIRED');
 const reason=text(b.reason,200);if(c.replayed)return {publicationId:c.publicationId,revision:c.head.revision,replayed:true};
 const now=new Date().toISOString(),ids=JSON.stringify(b.ids);
 // CAS, reference retention, receipt checkpoint and audit are one transactional batch.
 const written=await d.batch([
  d.prepare('INSERT INTO commerce_heads (singleton,active_publication_id,revision) VALUES (1,NULL,0) ON CONFLICT(singleton) DO NOTHING'),
  d.prepare(`INSERT INTO commerce_publications (id,content_hash,report_json,mapping_id,predecessor_id,created_at,actor,reason)
   SELECT ?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM commerce_heads WHERE singleton=1 AND revision=? AND active_publication_id IS ?)
    AND (SELECT COUNT(*) FROM (${currentInputs}))=? ON CONFLICT(id) DO NOTHING`)
   .bind(c.publicationId,c.hash,c.serialized,b.mappingId,b.expectedPublicationId,now,actor.id,reason,b.expectedRevision,b.expectedPublicationId,ids,NORMALIZER_VERSION,b.ids.length),
  d.prepare('INSERT INTO commerce_publication_inputs (publication_id,normalization_id) SELECT ?,value FROM json_each(?) WHERE EXISTS (SELECT 1 FROM commerce_publications WHERE id=?) ON CONFLICT DO NOTHING').bind(c.publicationId,ids,c.publicationId),
  d.prepare('UPDATE commerce_heads SET active_publication_id=?,revision=revision+1 WHERE singleton=1 AND revision=? AND active_publication_id IS ? AND EXISTS (SELECT 1 FROM commerce_publications WHERE id=?)').bind(c.publicationId,b.expectedRevision,b.expectedPublicationId,c.publicationId),
  d.prepare('INSERT INTO audit_events (id,actor,event_type,resource_id,occurred_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),actor.id,'commerce.published',c.publicationId,now),
  d.prepare(`UPDATE commerce_receipts SET state='PUBLISHED',published_version=? WHERE id IN (SELECT receipt_id FROM commerce_normalizations WHERE id IN (SELECT value FROM json_each(?))) AND EXISTS (SELECT 1 FROM commerce_heads WHERE singleton=1 AND active_publication_id=? AND revision=?)`).bind(c.publicationId,ids,c.publicationId,b.expectedRevision+1)
 ]);
 if(written.some(r=>!r.success))throw new AppError(503,'PUBLICATION_PERSISTENCE_FAILED');
 if(written[3]?.meta.changes!==1){const head=await d.prepare('SELECT active_publication_id,revision FROM commerce_heads WHERE singleton=1').first<Head>();if(head?.active_publication_id!==c.publicationId||head.revision!==b.expectedRevision+1)throw new AppError(409,'SOURCE_OR_PUBLICATION_CHANGED');}
 return {publicationId:c.publicationId,revision:b.expectedRevision+1,replayed:written[3]?.meta.changes!==1};
}
export async function readCommercePublication(db:Database,actor:InstallationUser,publicationId?:string){
 commerceOwner(actor);const d=database(db);
 const rows=await d.batch([
  d.prepare('SELECT active_publication_id,revision FROM commerce_heads WHERE singleton=1'),
  publicationId?d.prepare('SELECT * FROM commerce_publications WHERE id=?').bind(id(publicationId)):d.prepare('SELECT p.* FROM commerce_publications p JOIN commerce_heads h ON h.active_publication_id=p.id'),
  d.prepare(`SELECT r.id,r.state FROM commerce_receipts r JOIN commerce_connections c ON c.id=r.connection_id WHERE r.state IN ('ACCEPTED','QUARANTINED','RETRY_PENDING') OR c.state!='active' OR c.revision!=r.connection_revision ORDER BY r.received_at DESC LIMIT 21`),
  d.prepare(`SELECT c.state,c.revision,r.connection_revision,r.state AS receipt_state FROM commerce_publication_inputs i
   JOIN commerce_normalizations n ON n.id=i.normalization_id
   JOIN commerce_receipts r ON r.id=n.receipt_id
   JOIN commerce_connections c ON c.id=r.connection_id
   WHERE i.publication_id=COALESCE(?,(SELECT active_publication_id FROM commerce_heads WHERE singleton=1)) LIMIT 11`).bind(publicationId??null)
 ]);
 if(rows.some(r=>!r.success))throw new AppError(503,'PUBLICATION_UNAVAILABLE');
 const head=(rows[0]!.results[0] as unknown as Head|undefined)??{active_publication_id:null,revision:0},row=rows[1]!.results[0] as unknown as StoredReport|undefined;
 if(!row){if(publicationId)throw new AppError(404,'PUBLICATION_NOT_FOUND');return {activePublicationId:head.active_publication_id,revision:head.revision,publication:null,noPublishedData:true};}
 if(rows[3]!.results.some(r=>r.state!=='active'||r.revision!==r.connection_revision||r.receipt_state==='REVOKED'))throw new AppError(503,'PUBLICATION_SOURCE_REVOKED');
 const report=await storedReport(row);
 return {activePublicationId:head.active_publication_id,revision:head.revision,publication:{id:row.id,mappingId:row.mapping_id,contentHash:row.content_hash,publishedAt:row.created_at,report},noPublishedData:false,health:{pendingOrQuarantined:rows[2]!.results.slice(0,20),truncated:rows[2]!.results.length>20,scope:'retained-export-only',sourceCompletenessCertified:false}};
}
export async function readCommerceQueryPublication(db:Database,publicationId:string){
 const d=database(db),rows=await d.batch([
  d.prepare('SELECT p.* FROM commerce_publications p WHERE p.id=?').bind(id(publicationId)),
  d.prepare(`SELECT c.state,c.revision,r.connection_revision,r.state AS receipt_state FROM commerce_publication_inputs i
   JOIN commerce_normalizations n ON n.id=i.normalization_id
   JOIN commerce_receipts r ON r.id=n.receipt_id
   JOIN commerce_connections c ON c.id=r.connection_id
   WHERE i.publication_id=? LIMIT 11`).bind(id(publicationId))
 ]);
 if(rows.some(r=>!r.success))throw new AppError(503,'PUBLICATION_UNAVAILABLE');const row=rows[0]!.results[0] as unknown as StoredReport|undefined;if(!row)throw new AppError(404,'PUBLICATION_NOT_FOUND');
 if(rows[1]!.results.some(r=>r.state!=='active'||r.revision!==r.connection_revision||r.receipt_state==='REVOKED'))throw new AppError(503,'PUBLICATION_SOURCE_REVOKED');
 const report=await storedReport(row);return {id:row.id,contentHash:row.content_hash,report};
}
/** Metadata-only recovery surface: an invalidated report must not prevent a
 * permitted owner from pinning a replacement without exposing its business rows. */
export async function readCommercePublicationStatus(db:Database,actor:InstallationUser){
 commerceOwner(actor);const head=await database(db).prepare('SELECT active_publication_id,revision FROM commerce_heads WHERE singleton=1').first<Head>();
 return {activePublicationId:head?.active_publication_id??null,revision:head?.revision??0};
}
