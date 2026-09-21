import {AppError,id,object,text,day} from './contracts.ts';
import {commerceOwner} from './commerce-normalization.ts';
import type {InstallationUser} from './installation-auth.ts';
import type {Database} from './ports.ts';
const database=(db:Database)=>db.withSession?db.withSession('first-primary'):db;
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
export async function readCommerceCapabilities(db:Database,actor:InstallationUser){
 commerceOwner(actor);const rows=await database(db).prepare(`SELECT k.id,k.provider,k.source_account_id,k.resource_type,k.state,c.capability_id,c.state AS capability_state,c.evidence_ref,c.tested_at,c.coverage_json,c.revision AS capability_revision FROM commerce_connections k LEFT JOIN commerce_capabilities c ON c.connection_id=k.id ORDER BY k.id,c.capability_id LIMIT 200`).all();
 const connections=new Map<string,Record<string,unknown>>();for(const raw of rows.results){const r=raw as Record<string,unknown>,connectionId=String(r.id);let item=connections.get(connectionId);if(!item){item={connectionId,provider:String(r.provider),sourceAccountId:String(r.source_account_id),resourceType:String(r.resource_type),connectionState:String(r.state),capabilities:[] as unknown[]};connections.set(connectionId,item);}if(r.capability_id)(item.capabilities as unknown[]).push({capabilityId:String(r.capability_id),state:String(r.capability_state),evidenceRef:String(r.evidence_ref),testedAt:String(r.tested_at),coverage:JSON.parse(String(r.coverage_json)),revision:Number(r.capability_revision)});}
 return {connections:[...connections.values()],limit:200,liveProviderVerified:false};
}
export async function reviewCommerceCapability(db:Database,actor:InstallationUser,value:unknown){
 commerceOwner(actor);const b=parse(value),d=database(db),now=new Date().toISOString();const connection=await d.prepare('SELECT revision FROM commerce_connections WHERE id=?').bind(b.connectionId).first<{revision:number}>();if(!connection)throw new AppError(404,'SOURCE_NOT_FOUND');
 const existing=await d.prepare('SELECT revision FROM commerce_capabilities WHERE connection_id=? AND capability_id=?').bind(b.connectionId,b.capabilityId).first<{revision:number}>();if(existing&&b.expectedRevision===null)throw new AppError(428,'CAPABILITY_REVISION_REQUIRED');if(existing&&b.expectedRevision!==existing.revision)throw new AppError(409,'CAPABILITY_REVISION_CONFLICT');if(!existing&&b.expectedRevision!==null&&b.expectedRevision!==0)throw new AppError(409,'CAPABILITY_REVISION_CONFLICT');
 const revision=(existing?.revision??0)+1,payload=JSON.stringify(b.coverage),write=existing?d.prepare('UPDATE commerce_capabilities SET state=?,evidence_ref=?,tested_at=?,coverage_json=?,revision=?,actor=? WHERE connection_id=? AND capability_id=? AND revision=?').bind(b.state,b.evidenceRef,b.testedAt,payload,revision,actor.id,b.connectionId,b.capabilityId,b.expectedRevision):d.prepare('INSERT INTO commerce_capabilities (connection_id,capability_id,state,evidence_ref,tested_at,coverage_json,revision,actor) VALUES (?,?,?,?,?,?,?,?)').bind(b.connectionId,b.capabilityId,b.state,b.evidenceRef,b.testedAt,payload,revision,actor.id);
 const result=await d.batch([write,d.prepare('INSERT INTO audit_events (id,actor,event_type,resource_id,occurred_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),actor.id,'commerce.capability-reviewed',`${b.connectionId}:${b.capabilityId}`,now)]);if(result[0]?.meta.changes!==1)throw new AppError(409,'CAPABILITY_REVISION_CONFLICT');return {connectionId:b.connectionId,capabilityId:b.capabilityId,state:b.state,revision,liveProviderVerified:false};
}
