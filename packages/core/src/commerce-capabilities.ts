import {AppError,id,object,text,day} from './contracts.ts';
import {commerceOwner} from './commerce-normalization.ts';
import type {TenantContext} from './tenant.ts';
const database=(ctx:TenantContext)=>ctx.db.withSession?ctx.db.withSession('first-primary'):ctx.db;
const states=['UNKNOWN','SUPPORTED','MISSING_SCOPE','UNSUPPORTED','BLOCKED_APPROVAL','DEGRADED'] as const;
const allowed=new Set(['orders','settlements','inventory','fees','historical_cost','warehouse_scope','returns']);
function manifest(value:unknown){
 const b=object(value,['requestedWindow','fetchedWindow','sourceConfirmedWindow','publishedWindow','shops','warehouses','fieldsMasked']);
 for(const key of ['requestedWindow','fetchedWindow','sourceConfirmedWindow','publishedWindow'])if(b[key]!==null){const w=object(b[key],['from','toExclusive']);day(w.from);day(w.toExclusive);}
 for(const key of ['shops','warehouses','fieldsMasked'])if(!Array.isArray(b[key])||b[key].length>100||b[key].some(x=>typeof x!=='string'||x.length>128))throw new AppError(422,'INVALID_CAPABILITY_COVERAGE');
 return b;
}
function parse(value:unknown){
 const b=object(value,['connectionId','capabilityId','state','evidenceRef','testedAt','coverage','expectedRevision']),connectionId=id(b.connectionId),capabilityId=text(b.capabilityId,64);
 if(!allowed.has(capabilityId))throw new AppError(422,'UNKNOWN_CAPABILITY');if(!states.includes(String(b.state) as never))throw new AppError(422,'INVALID_CAPABILITY_STATE');
 const testedAt=day(b.testedAt),expectedRevision=b.expectedRevision===undefined?null:Number(b.expectedRevision);if(expectedRevision!==null&&(!Number.isSafeInteger(expectedRevision)||expectedRevision<0))throw new AppError(400,'INVALID_CAPABILITY_REVISION');
 return {connectionId,capabilityId,state:String(b.state),evidenceRef:text(b.evidenceRef,128),testedAt,coverage:manifest(b.coverage),expectedRevision};
}
export async function readCommerceCapabilities(ctx:TenantContext){
 commerceOwner(ctx);const rows=await database(ctx).prepare(`SELECT k.id,k.provider,k.source_account_id,k.resource_type,k.state,c.capability_id,c.state AS capability_state,c.evidence_ref,c.tested_at,c.coverage_json,c.revision AS capability_revision FROM commerce_connections k LEFT JOIN commerce_capabilities c ON c.tenant_id=k.tenant_id AND c.connection_id=k.id WHERE k.tenant_id=? ORDER BY k.id,c.capability_id LIMIT 200`).bind(ctx.id).all();
 const connections=new Map<string,any>();for(const raw of rows.results){const r=raw as Record<string,unknown>,connectionId=String(r.id);let item=connections.get(connectionId);if(!item){item={connectionId,provider:String(r.provider),sourceAccountId:String(r.source_account_id),resourceType:String(r.resource_type),connectionState:String(r.state),capabilities:[]};connections.set(connectionId,item);}if(r.capability_id)item.capabilities.push({capabilityId:String(r.capability_id),state:String(r.capability_state),evidenceRef:String(r.evidence_ref),testedAt:String(r.tested_at),coverage:JSON.parse(String(r.coverage_json)),revision:Number(r.capability_revision)});}
 return {connections:[...connections.values()],limit:200,liveProviderVerified:false};
}
export async function reviewCommerceCapability(ctx:TenantContext,value:unknown){
 commerceOwner(ctx);const b=parse(value),db=database(ctx),now=new Date().toISOString();const connection=await db.prepare('SELECT revision FROM commerce_connections WHERE tenant_id=? AND id=?').bind(ctx.id,b.connectionId).first<{revision:number}>();if(!connection)throw new AppError(404,'SOURCE_NOT_FOUND');
 const existing=await db.prepare('SELECT revision FROM commerce_capabilities WHERE tenant_id=? AND connection_id=? AND capability_id=?').bind(ctx.id,b.connectionId,b.capabilityId).first<{revision:number}>();if(existing&&b.expectedRevision===null)throw new AppError(428,'CAPABILITY_REVISION_REQUIRED');if(existing&&b.expectedRevision!==existing.revision)throw new AppError(409,'CAPABILITY_REVISION_CONFLICT');if(!existing&&b.expectedRevision!==null&&b.expectedRevision!==0)throw new AppError(409,'CAPABILITY_REVISION_CONFLICT');
 const revision=(existing?.revision??0)+1,payload=JSON.stringify(b.coverage),write=existing?db.prepare('UPDATE commerce_capabilities SET state=?,evidence_ref=?,tested_at=?,coverage_json=?,revision=?,actor=? WHERE tenant_id=? AND connection_id=? AND capability_id=? AND revision=?').bind(b.state,b.evidenceRef,b.testedAt,payload,revision,ctx.principal.subject,ctx.id,b.connectionId,b.capabilityId,b.expectedRevision):db.prepare('INSERT INTO commerce_capabilities VALUES (?,?,?,?,?,?,?,?,?)').bind(ctx.id,b.connectionId,b.capabilityId,b.state,b.evidenceRef,b.testedAt,payload,revision,ctx.principal.subject);
 const result=await db.batch([write,db.prepare('INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),ctx.id,ctx.principal.subject,'commerce.capability-reviewed',`${b.connectionId}:${b.capabilityId}`,now)]);if(result[0]?.meta.changes!==1)throw new AppError(409,'CAPABILITY_REVISION_CONFLICT');return {connectionId:b.connectionId,capabilityId:b.capabilityId,state:b.state,revision,liveProviderVerified:false};
}
