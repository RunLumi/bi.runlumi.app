import {AppError,id,object,text} from './contracts.ts';
import {commerceOwner} from './commerce-normalization.ts';
import type {InstallationUser} from './installation-auth.ts';
import type {Database} from './ports.ts';
const database=(db:Database)=>db.withSession?db.withSession('first-primary'):db;
export async function readCommerceConnections(db:Database,actor:InstallationUser){
 commerceOwner(actor);const rows=await database(db).prepare('SELECT id,provider,source_account_id,resource_type,transport,state,revision FROM commerce_connections ORDER BY id LIMIT 50').all();
 return {connections:rows.results.map(r=>({id:r.id,provider:r.provider,sourceAccountId:r.source_account_id,resourceType:r.resource_type,transport:r.transport,state:r.state,revision:r.revision,liveProviderVerified:false})),limit:50};
}
export async function createCommerceConnection(db:Database,actor:InstallationUser,value:unknown){
 commerceOwner(actor);const b=object(value,['id','provider','sourceAccountId','resourceType','approvalRef']),connectionId=id(b.id),account=text(b.sourceAccountId,128),approval=text(b.approvalRef,128);
 if(!['generic','nhanh','haravan','shopee'].includes(String(b.provider))||!['orders','settlements','inventory'].includes(String(b.resourceType)))throw new AppError(422,'INVALID_SOURCE_IDENTITY');
 const d=database(db),now=new Date().toISOString();
 const result=await d.batch([
  d.prepare(`INSERT INTO commerce_connections (id,provider,source_account_id,resource_type,transport,approval_ref,state,revision)
   SELECT ?,?,?,?, 'authorized-export',?,'active',1 WHERE (SELECT COUNT(*) FROM commerce_connections)<50 ON CONFLICT(id) DO NOTHING`)
   .bind(connectionId,String(b.provider),account,String(b.resourceType),approval),
  d.prepare("INSERT INTO commerce_source_events (connection_id,revision,state,actor,reason,occurred_at) SELECT ?,1,'active',?,?,? WHERE changes()=1").bind(connectionId,actor.id,approval,now),
  d.prepare('INSERT INTO audit_events (id,actor,event_type,resource_id,occurred_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),actor.id,'commerce.source-authorized',connectionId,now)
 ]);
 if(result[0]?.meta.changes!==1)throw new AppError(409,'CONNECTION_EXISTS_OR_QUOTA');
 return {connectionId,revision:1,transport:'authorized-export',liveProviderVerified:false};
}
export async function changeCommerceConnection(db:Database,actor:InstallationUser,connectionId:string,value:unknown,expected:number){
 commerceOwner(actor);const b=object(value,['state','reason']);text(b.reason,200);
 if(!['active','paused','revoked'].includes(String(b.state)))throw new AppError(422,'INVALID_CONNECTION_STATE');
 const d=database(db),now=new Date().toISOString();const result=await d.batch([
  d.prepare('UPDATE commerce_connections SET state=?,revision=revision+1 WHERE id=? AND revision=? AND state!=\'revoked\'').bind(String(b.state),id(connectionId),expected),
  d.prepare('INSERT INTO commerce_source_events (connection_id,revision,state,actor,reason,occurred_at) SELECT ?,?,?,?,?,? WHERE changes()=1').bind(id(connectionId),expected+1,String(b.state),actor.id,text(b.reason,200),now),
  d.prepare('INSERT INTO audit_events (id,actor,event_type,resource_id,occurred_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),actor.id,'commerce.source-'+String(b.state),id(connectionId),now)
 ]);
 if(result[0]?.meta.changes!==1)throw new AppError(409,'CONNECTION_REVISION_OR_STATE_CONFLICT');return {connectionId,state:b.state,revision:expected+1};
}
