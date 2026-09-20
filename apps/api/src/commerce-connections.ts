import {AppError,id,object,text} from '../../../packages/core/contracts.ts';
import {commerceOwner} from './commerce-normalization.ts';
import type {TenantContext} from './tenant.ts';
const database=(ctx:TenantContext)=>ctx.db.withSession?ctx.db.withSession('first-primary'):ctx.db;
export async function readCommerceConnections(ctx:TenantContext){
 commerceOwner(ctx);const rows=await database(ctx).prepare('SELECT id,provider,source_account_id,resource_type,transport,state,revision FROM commerce_connections WHERE tenant_id=? ORDER BY id LIMIT 50').bind(ctx.id).all();
 return {connections:rows.results.map(r=>({id:r.id,provider:r.provider,sourceAccountId:r.source_account_id,resourceType:r.resource_type,transport:r.transport,state:r.state,revision:r.revision,liveProviderVerified:false})),limit:50};
}
export async function createCommerceConnection(ctx:TenantContext,value:unknown){
 commerceOwner(ctx);const b=object(value,['id','provider','sourceAccountId','resourceType','approvalRef']),connectionId=id(b.id),account=text(b.sourceAccountId,128),approval=text(b.approvalRef,128);
 if(!['generic','nhanh','haravan','shopee'].includes(String(b.provider))||!['orders','settlements','inventory'].includes(String(b.resourceType)))throw new AppError(422,'INVALID_SOURCE_IDENTITY');
 const db=database(ctx),now=new Date().toISOString();
 const result=await db.batch([
  db.prepare(`INSERT INTO commerce_connections (tenant_id,id,provider,source_account_id,resource_type,transport,approval_ref,state,revision)
   SELECT ?,?,?,?,?,'authorized-export',?,'active',1 WHERE EXISTS (SELECT 1 FROM tenant_identity WHERE tenant_id=? AND route_epoch=?)
   AND (SELECT COUNT(*) FROM commerce_connections WHERE tenant_id=?)<50 ON CONFLICT(tenant_id,id) DO NOTHING`)
   .bind(ctx.id,connectionId,String(b.provider),account,String(b.resourceType),approval,ctx.id,ctx.routeEpoch,ctx.id),
  db.prepare("INSERT INTO commerce_source_events SELECT ?,?,1,'active',?,?,? WHERE changes()=1").bind(ctx.id,connectionId,ctx.principal.subject,approval,now),
  db.prepare('INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),ctx.id,ctx.principal.subject,'commerce.source-authorized',connectionId,now)
 ]);
 if(result[0]?.meta.changes!==1)throw new AppError(409,'CONNECTION_EXISTS_OR_QUOTA');
 return {connectionId,revision:1,transport:'authorized-export',liveProviderVerified:false};
}
export async function changeCommerceConnection(ctx:TenantContext,connectionId:string,value:unknown,expected:number){
 commerceOwner(ctx);const b=object(value,['state','reason']);text(b.reason,200);
 if(!['active','paused','revoked'].includes(String(b.state)))throw new AppError(422,'INVALID_CONNECTION_STATE');
 const db=database(ctx),now=new Date().toISOString();const result=await db.batch([
  db.prepare(`UPDATE commerce_connections SET state=?,revision=revision+1 WHERE tenant_id=? AND id=? AND revision=? AND state!='revoked'
   AND EXISTS (SELECT 1 FROM tenant_identity WHERE tenant_id=? AND route_epoch=?)`).bind(String(b.state),ctx.id,id(connectionId),expected,ctx.id,ctx.routeEpoch),
  db.prepare('INSERT INTO commerce_source_events SELECT ?,?,?,?,?,?,? WHERE changes()=1').bind(ctx.id,connectionId,expected+1,String(b.state),ctx.principal.subject,String(b.reason),now),
  db.prepare('INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),ctx.id,ctx.principal.subject,'commerce.source-'+String(b.state),connectionId,now)
 ]);
 if(result[0]?.meta.changes!==1)throw new AppError(409,'CONNECTION_REVISION_OR_STATE_CONFLICT');return {connectionId,state:b.state,revision:expected+1};
}
