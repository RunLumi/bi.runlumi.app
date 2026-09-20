import {AppError,id,integer,object,sha256,text} from './contracts.ts';
import {NORMALIZER_VERSION,type NormalizedExport} from './commerce-model.ts';
import {assembleCommerceReport,parseIdentityMapping,parseSourceControls,type CommerceReport,type IdentityMapping} from './commerce-report.ts';
import {commerceOwner} from './commerce-normalization.ts';
import type {TenantContext} from './tenant.ts';
const database=(ctx:TenantContext)=>ctx.db.withSession?ctx.db.withSession('first-primary'):ctx.db;
interface Head {active_publication_id:string|null;revision:number}
interface StoredReport {id:string;mapping_id:string|null;content_hash:string;report_json:string;created_at:string}
interface InputRow {id:string;receipt_id:string;connection_id:string;content_hash:string;raw_content_hash:string;payload_json:string}
const currentInputs=`SELECT n.id,n.receipt_id,r.connection_id,n.content_hash,n.raw_content_hash,n.payload_json FROM commerce_normalizations n
 JOIN commerce_receipts r ON r.tenant_id=n.tenant_id AND r.id=n.receipt_id
 JOIN commerce_connections c ON c.tenant_id=r.tenant_id AND c.id=r.connection_id
 JOIN tenant_identity t ON t.tenant_id=n.tenant_id
 WHERE n.tenant_id=? AND n.id IN (SELECT value FROM json_each(?)) AND n.state='NORMALIZED' AND n.normalizer_version=?
  AND r.state!='REVOKED' AND c.state='active' AND c.revision=r.connection_revision
  AND t.route_epoch=? AND r.route_epoch=t.route_epoch`;
function parseCandidate(value:unknown){
 const b=object(value,['normalizationIds','mappingId','controls','expectedRevision','expectedPublicationId','previewHash','reason']);
 if(!Array.isArray(b.normalizationIds)||!b.normalizationIds.length||b.normalizationIds.length>10)throw new AppError(422,'PUBLICATION_INPUT_LIMIT');
 const ids=b.normalizationIds.map(id).sort();if(new Set(ids).size!==ids.length)throw new AppError(422,'DUPLICATE_PUBLICATION_INPUT');
 return {ids,mappingId:b.mappingId===null?null:id(b.mappingId),controls:parseSourceControls(b.controls),expectedRevision:integer(b.expectedRevision),expectedPublicationId:b.expectedPublicationId===null?null:id(b.expectedPublicationId),previewHash:b.previewHash,reason:b.reason};
}
export async function registerCommerceMapping(ctx:TenantContext,input:unknown){
 commerceOwner(ctx);const mapping=parseIdentityMapping(input),payload=JSON.stringify(mapping),hash=await sha256(payload),mappingId='cm_'+hash.slice(0,48),db=database(ctx),now=new Date().toISOString();
 if(new TextEncoder().encode(payload).byteLength>48_000)throw new AppError(422,'MAPPING_LIMIT');
 const result=await db.batch([
  db.prepare(`INSERT INTO commerce_mappings SELECT ?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM tenant_identity WHERE tenant_id=? AND route_epoch=?) ON CONFLICT(tenant_id,id) DO NOTHING`).bind(ctx.id,mappingId,hash,payload,now,ctx.principal.subject,ctx.id,ctx.routeEpoch),
  db.prepare('INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),ctx.id,ctx.principal.subject,'commerce.mapping-reviewed',mappingId,now)
 ]);
 const found=await db.prepare('SELECT content_hash FROM commerce_mappings WHERE tenant_id=? AND id=?').bind(ctx.id,mappingId).first<{content_hash:string}>();
 if(!found)throw new AppError(409,'SOURCE_OR_ROUTE_CHANGED');if(found.content_hash!==hash)throw new AppError(503,'MAPPING_INTEGRITY');
 return {mappingId,contentHash:hash,replayed:result[0]?.meta.changes!==1,provenance:'owner-reviewed',attestationVerified:false};
}
async function storedReport(row:StoredReport):Promise<CommerceReport>{
 if(new TextEncoder().encode(row.report_json).byteLength>512_000||await sha256(row.report_json)!==row.content_hash)throw new AppError(503,'PUBLICATION_INTEGRITY');
 const report=JSON.parse(row.report_json) as CommerceReport;
 if(report.contract!=='lumi.commerce.report.v1')throw new AppError(503,'UNSUPPORTED_REPORT_VERSION');return report;
}
async function candidate(ctx:TenantContext,input:unknown){
 commerceOwner(ctx);const b=parseCandidate(input),db=database(ctx);
 const rows=await db.batch([
  db.prepare(currentInputs).bind(ctx.id,JSON.stringify(b.ids),NORMALIZER_VERSION,ctx.routeEpoch),
  db.prepare('SELECT active_publication_id,revision FROM commerce_heads WHERE tenant_id=?').bind(ctx.id),
   db.prepare('SELECT p.* FROM commerce_publications p JOIN commerce_heads h ON h.tenant_id=p.tenant_id AND h.active_publication_id=p.id WHERE p.tenant_id=?').bind(ctx.id),
   db.prepare('SELECT payload_json,content_hash FROM commerce_mappings WHERE tenant_id=? AND id=?').bind(ctx.id,b.mappingId),
   db.prepare('SELECT connection_id,capability_id,state,coverage_json FROM commerce_capabilities WHERE tenant_id=?').bind(ctx.id)
 ]);
 if(rows.some(r=>!r.success)||rows[0]!.results.length!==b.ids.length)throw new AppError(409,'NORMALIZATION_SCOPE_CHANGED');
 let mapping:IdentityMapping|null=null;
 if(b.mappingId!==null){const r=rows[3]!.results[0];if(!r||typeof r.payload_json!=='string'||new TextEncoder().encode(r.payload_json).byteLength>48_000||await sha256(r.payload_json)!==r.content_hash)throw new AppError(503,'MAPPING_INTEGRITY');mapping=parseIdentityMapping(JSON.parse(r.payload_json));}
 const inputs=[];
  for(const raw of rows[0]!.results){const r=raw as unknown as InputRow;if(await sha256(r.payload_json)!==r.content_hash)throw new AppError(503,'NORMALIZATION_INTEGRITY');const data=JSON.parse(r.payload_json) as NormalizedExport;if(data.tenantId!==ctx.id||data.normalizerVersion!==NORMALIZER_VERSION)throw new AppError(503,'NORMALIZATION_IDENTITY_MISMATCH');inputs.push({normalizationId:r.id,receiptId:r.receipt_id,contentHash:r.content_hash,rawContentHash:r.raw_content_hash,connectionId:r.connection_id,data});}
 inputs.sort((a,b)=>a.normalizationId<b.normalizationId?-1:1);
  const report=assembleCommerceReport(inputs,mapping,b.controls);
  const capabilities=rows[4]!.results as unknown as {connection_id:string;capability_id:string;state:string;coverage_json:string}[];
   const sourceConnections=new Set(inputs.map(input=>input.connectionId));
  const warnings=new Set(report.warnings);
  for(const capability of capabilities){
   if(!sourceConnections.has(capability.connection_id)||capability.state==='UNKNOWN'||capability.state==='SUPPORTED')continue;
   warnings.add(`CAPABILITY_${capability.state}_${capability.capability_id}`);
   if(capability.capability_id==='fees'&&capability.state!=='SUPPORTED')report.metrics.contribution_pre_ads=null;
   if(capability.capability_id==='warehouse_scope'&&capability.state!=='SUPPORTED')report.metrics.available_units=null;
  }
  report.warnings=[...warnings];
  const serialized=JSON.stringify(report);
 if(new TextEncoder().encode(serialized).byteLength>512_000)throw new AppError(422,'PUBLICATION_BUDGET_EXCEEDED');
 const hash=await sha256(serialized),previewHash=await sha256(JSON.stringify([ctx.id,ctx.routeEpoch,b.ids,b.mappingId,b.controls,b.expectedRevision,b.expectedPublicationId,hash])),publicationId='cp_'+previewHash.slice(0,48);
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
 return {b,db,report,serialized,hash,previewHash,publicationId,head,replayed};
}
export async function previewCommercePublication(ctx:TenantContext,input:unknown){
 const c=await candidate(ctx,input);return {publicationId:c.publicationId,previewHash:c.previewHash,report:c.report,expectedRevision:c.b.expectedRevision,published:false};
}
export async function publishCommerce(ctx:TenantContext,input:unknown){
 const c=await candidate(ctx,input),{b,db}=c;
 if(b.previewHash!==c.previewHash)throw new AppError(409,'PUBLICATION_PREVIEW_REQUIRED');
 const reason=text(b.reason,200);if(c.replayed)return {publicationId:c.publicationId,revision:c.head.revision,replayed:true};
 const now=new Date().toISOString(),ids=JSON.stringify(b.ids);
 // CAS, reference retention, receipt checkpoint and audit are one transactional batch.
 const written=await db.batch([
  db.prepare('INSERT INTO commerce_heads (tenant_id,active_publication_id,revision) VALUES (?,NULL,0) ON CONFLICT(tenant_id) DO NOTHING').bind(ctx.id),
  db.prepare(`INSERT INTO commerce_publications (tenant_id,id,content_hash,report_json,mapping_id,predecessor_id,created_at,actor,reason)
   SELECT ?,?,?,?,?,?,?,?,? WHERE EXISTS (SELECT 1 FROM commerce_heads h JOIN tenant_identity t ON t.tenant_id=h.tenant_id
    WHERE h.tenant_id=? AND h.revision=? AND h.active_publication_id IS ? AND t.route_epoch=?)
    AND (SELECT COUNT(*) FROM (${currentInputs}))=? ON CONFLICT(tenant_id,id) DO NOTHING`)
   .bind(ctx.id,c.publicationId,c.hash,c.serialized,b.mappingId,b.expectedPublicationId,now,ctx.principal.subject,reason,ctx.id,b.expectedRevision,b.expectedPublicationId,ctx.routeEpoch,ctx.id,ids,NORMALIZER_VERSION,ctx.routeEpoch,b.ids.length),
  db.prepare(`INSERT INTO commerce_publication_inputs SELECT ?,?,value FROM json_each(?) WHERE EXISTS (SELECT 1 FROM commerce_publications WHERE tenant_id=? AND id=?) ON CONFLICT DO NOTHING`).bind(ctx.id,c.publicationId,ids,ctx.id,c.publicationId),
  db.prepare(`UPDATE commerce_heads SET active_publication_id=?,revision=revision+1 WHERE tenant_id=? AND revision=? AND active_publication_id IS ?
   AND EXISTS (SELECT 1 FROM commerce_publications WHERE tenant_id=? AND id=?)
   AND EXISTS (SELECT 1 FROM tenant_identity WHERE tenant_id=? AND route_epoch=?)`)
   .bind(c.publicationId,ctx.id,b.expectedRevision,b.expectedPublicationId,ctx.id,c.publicationId,ctx.id,ctx.routeEpoch),
  db.prepare('INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),ctx.id,ctx.principal.subject,'commerce.published',c.publicationId,now),
  db.prepare(`UPDATE commerce_receipts SET state='PUBLISHED',published_version=? WHERE tenant_id=?
   AND id IN (SELECT receipt_id FROM commerce_normalizations WHERE tenant_id=? AND id IN (SELECT value FROM json_each(?)))
   AND EXISTS (SELECT 1 FROM commerce_heads WHERE tenant_id=? AND active_publication_id=? AND revision=?)`)
   .bind(c.publicationId,ctx.id,ctx.id,ids,ctx.id,c.publicationId,b.expectedRevision+1)
 ]);
 if(written.some(r=>!r.success))throw new AppError(503,'PUBLICATION_PERSISTENCE_FAILED');
 if(written[3]?.meta.changes!==1){const head=await db.prepare('SELECT active_publication_id,revision FROM commerce_heads WHERE tenant_id=?').bind(ctx.id).first<Head>();if(head?.active_publication_id!==c.publicationId||head.revision!==b.expectedRevision+1)throw new AppError(409,'SOURCE_OR_PUBLICATION_CHANGED');}
 return {publicationId:c.publicationId,revision:b.expectedRevision+1,replayed:written[3]?.meta.changes!==1};
}
export async function readCommercePublication(ctx:TenantContext,publicationId?:string){
 commerceOwner(ctx);const db=database(ctx);
 const rows=await db.batch([
  db.prepare('SELECT active_publication_id,revision FROM commerce_heads WHERE tenant_id=?').bind(ctx.id),
  publicationId?db.prepare('SELECT * FROM commerce_publications WHERE tenant_id=? AND id=?').bind(ctx.id,id(publicationId)):db.prepare('SELECT p.* FROM commerce_publications p JOIN commerce_heads h ON h.tenant_id=p.tenant_id AND h.active_publication_id=p.id WHERE p.tenant_id=?').bind(ctx.id),
  db.prepare(`SELECT r.id,r.state FROM commerce_receipts r JOIN commerce_connections c ON c.tenant_id=r.tenant_id AND c.id=r.connection_id WHERE r.tenant_id=? AND (r.state IN ('ACCEPTED','QUARANTINED','RETRY_PENDING') OR c.state!='active' OR c.revision!=r.connection_revision) ORDER BY r.received_at DESC LIMIT 21`).bind(ctx.id),
  db.prepare(`SELECT c.state,c.revision,r.connection_revision,r.state AS receipt_state FROM commerce_publication_inputs i
   JOIN commerce_normalizations n ON n.tenant_id=i.tenant_id AND n.id=i.normalization_id
   JOIN commerce_receipts r ON r.tenant_id=n.tenant_id AND r.id=n.receipt_id
   JOIN commerce_connections c ON c.tenant_id=r.tenant_id AND c.id=r.connection_id
   WHERE i.tenant_id=? AND i.publication_id=COALESCE(?,(SELECT active_publication_id FROM commerce_heads WHERE tenant_id=?)) LIMIT 11`).bind(ctx.id,publicationId??null,ctx.id)
 ]);
 if(rows.some(r=>!r.success))throw new AppError(503,'PUBLICATION_UNAVAILABLE');
 const head=(rows[0]!.results[0] as unknown as Head|undefined)??{active_publication_id:null,revision:0},row=rows[1]!.results[0] as unknown as StoredReport|undefined;
 if(!row){if(publicationId)throw new AppError(404,'PUBLICATION_NOT_FOUND');return {activePublicationId:head.active_publication_id,revision:head.revision,publication:null,noPublishedData:true};}
 if(rows[3]!.results.some(r=>r.state!=='active'||r.revision!==r.connection_revision||r.receipt_state==='REVOKED'))throw new AppError(503,'PUBLICATION_SOURCE_REVOKED');
 const report=await storedReport(row);if(report.tenantId!==ctx.id)throw new AppError(503,'PUBLICATION_IDENTITY_MISMATCH');
 return {activePublicationId:head.active_publication_id,revision:head.revision,publication:{id:row.id,mappingId:row.mapping_id,contentHash:row.content_hash,publishedAt:row.created_at,report},noPublishedData:false,health:{pendingOrQuarantined:rows[2]!.results.slice(0,20),truncated:rows[2]!.results.length>20,scope:'retained-export-only',sourceCompletenessCertified:false}};
}
export async function readCommerceQueryPublication(ctx:TenantContext,publicationId:string){
 const db=database(ctx),rows=await db.batch([
  db.prepare('SELECT p.* FROM commerce_publications p WHERE p.tenant_id=? AND p.id=?').bind(ctx.id,publicationId),
  db.prepare(`SELECT c.state,c.revision,r.connection_revision,r.state AS receipt_state FROM commerce_publication_inputs i
   JOIN commerce_normalizations n ON n.tenant_id=i.tenant_id AND n.id=i.normalization_id
   JOIN commerce_receipts r ON r.tenant_id=n.tenant_id AND r.id=n.receipt_id
   JOIN commerce_connections c ON c.tenant_id=r.tenant_id AND c.id=r.connection_id
   WHERE i.tenant_id=? AND i.publication_id=? LIMIT 11`).bind(ctx.id,publicationId)
 ]);
 if(rows.some(r=>!r.success))throw new AppError(503,'PUBLICATION_UNAVAILABLE');const row=rows[0]!.results[0] as unknown as StoredReport|undefined;if(!row)throw new AppError(404,'PUBLICATION_NOT_FOUND');
 if(rows[1]!.results.some(r=>r.state!=='active'||r.revision!==r.connection_revision||r.receipt_state==='REVOKED'))throw new AppError(503,'PUBLICATION_SOURCE_REVOKED');
 const report=await storedReport(row);if(report.tenantId!==ctx.id)throw new AppError(503,'PUBLICATION_IDENTITY_MISMATCH');return {id:row.id,contentHash:row.content_hash,report};
}
/** Metadata-only recovery surface: an invalidated report must not prevent a
 * permitted owner from pinning a replacement without exposing its business rows. */
export async function readCommercePublicationStatus(ctx:TenantContext){
 commerceOwner(ctx);const head=await database(ctx).prepare('SELECT active_publication_id,revision FROM commerce_heads WHERE tenant_id=?').bind(ctx.id).first<Head>();
 return {activePublicationId:head?.active_publication_id??null,revision:head?.revision??0};
}
