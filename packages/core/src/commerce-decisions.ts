import {AppError,day,id,object,sha256,text} from './contracts.ts';
import {commerceFindings,findingResolved,commerceSummaryCsv,DETECTOR_VERSION,type CommerceFinding} from './commerce-insights.ts';
import {invalidPublicationSources} from './commerce-evidence.ts';
import {commerceOwner} from './commerce-normalization.ts';
import {readCommercePublication} from './commerce-publication.ts';
import type {TenantContext} from './tenant.ts';
const database=(ctx:TenantContext)=>ctx.db.withSession?ctx.db.withSession('first-primary'):ctx.db;
export async function readCommerceInsights(ctx:TenantContext){
 const data=await readCommercePublication(ctx);return {publicationId:data.publication?.id??null,detectorVersion:DETECTOR_VERSION,findings:data.publication?commerceFindings(data.publication.report):[],noPublishedData:data.noPublishedData,autonomousActionsEnabled:false};
}
export async function createCommerceDecision(ctx:TenantContext,value:unknown){
 commerceOwner(ctx);const b=object(value,['publicationId','findingId','rationale','dueOn']),publicationId=id(b.publicationId),findingId=text(b.findingId,128),rationale=text(b.rationale,1000),dueOn=b.dueOn===null?null:day(b.dueOn);
 const current=await readCommercePublication(ctx,publicationId);
 if(current.activePublicationId!==publicationId||!current.publication)throw new AppError(409,'DECISION_REQUIRES_CURRENT_EVIDENCE');
 const finding=commerceFindings(current.publication.report).find(f=>f.id===findingId);if(!finding)throw new AppError(404,'FINDING_NOT_FOUND');
 const decisionId='cd_'+(await sha256(JSON.stringify([ctx.id,findingId]))).slice(0,48),db=database(ctx),now=new Date().toISOString();
 const result=await db.batch([
  db.prepare(`INSERT INTO commerce_decisions
   (tenant_id,id,publication_id,finding_id,finding_json,detector_version,owner_subject,rationale,due_on,state,revision,created_at,updated_at)
   SELECT ?,?,?,?,?,?,?,?,?,'OPEN',1,?,? WHERE EXISTS
    (SELECT 1 FROM commerce_heads h JOIN tenant_identity t ON t.tenant_id=h.tenant_id WHERE h.tenant_id=? AND h.active_publication_id=? AND t.route_epoch=?)
   AND NOT EXISTS (SELECT 1 FROM (${invalidPublicationSources}) x WHERE x.tenant_id=? AND x.publication_id=?)
   ON CONFLICT(tenant_id,finding_id) DO NOTHING`)
   .bind(ctx.id,decisionId,publicationId,findingId,JSON.stringify(finding),DETECTOR_VERSION,ctx.principal.subject,rationale,dueOn,now,now,ctx.id,publicationId,ctx.routeEpoch,ctx.id,publicationId),
  db.prepare("INSERT INTO commerce_decision_events SELECT ?,?,1,NULL,'OPEN',?,?,?,? WHERE changes()=1").bind(ctx.id,decisionId,ctx.principal.subject,rationale,publicationId,now),
  db.prepare('INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),ctx.id,ctx.principal.subject,'commerce.decision-opened',decisionId,now)
 ]);
 const row=await db.prepare('SELECT id,state,revision FROM commerce_decisions WHERE tenant_id=? AND id=?').bind(ctx.id,decisionId).first<{id:string;state:string;revision:number}>();
 if(!row)throw new AppError(409,'DECISION_EVIDENCE_CHANGED');
 if(['RESOLVED','ACCEPTED_LIMITATION'].includes(row.state))throw new AppError(409,'RECURRENCE_REVIEW_REQUIRED');
 return {...row,replayed:result[0]?.meta.changes!==1,externalActionExecuted:false};
}
export async function updateCommerceDecision(ctx:TenantContext,decisionId:string,value:unknown,expected:number){
 commerceOwner(ctx);const b=object(value,['state','note','outcomePublicationId']),state=text(b.state,32),note=text(b.note,1000),outcome=b.outcomePublicationId===null?null:id(b.outcomePublicationId),db=database(ctx);
 const prior=await db.prepare('SELECT state,publication_id,finding_json,revision FROM commerce_decisions WHERE tenant_id=? AND id=?').bind(ctx.id,id(decisionId)).first<{state:string;publication_id:string;finding_json:string;revision:number}>();
 if(!prior)throw new AppError(404,'DECISION_NOT_FOUND');
 const transitions:Record<string,string[]>={OPEN:['INVESTIGATING','ACCEPTED_LIMITATION'],INVESTIGATING:['AWAITING_OUTCOME','ACCEPTED_LIMITATION'],AWAITING_OUTCOME:['INVESTIGATING','RESOLVED','ACCEPTED_LIMITATION']};
 if(!transitions[prior.state]?.includes(state))throw new AppError(409,'INVALID_DECISION_TRANSITION');
 if(prior.revision!==expected)throw new AppError(409,'REVISION_CONFLICT');
 if(state==='RESOLVED'){
  if(!outcome||outcome===prior.publication_id)throw new AppError(409,'NEW_OUTCOME_EVIDENCE_REQUIRED');
  const [baseline,next]=await Promise.all([readCommercePublication(ctx,prior.publication_id),readCommercePublication(ctx,outcome)]);
  const finding=JSON.parse(prior.finding_json) as CommerceFinding;
  if(!baseline.publication||!next.publication||next.activePublicationId!==outcome||JSON.stringify(baseline.publication.report.window)!==JSON.stringify(next.publication.report.window)||baseline.publication.mappingId!==next.publication.mappingId||baseline.publication.report.semanticVersion!==next.publication.report.semanticVersion||baseline.publication.report.taxBasis!==next.publication.report.taxBasis||!findingResolved(next.publication.report,finding))throw new AppError(409,'OUTCOME_NOT_OBSERVED');
 }else if(outcome!==null)throw new AppError(400,'OUTCOME_NOT_APPLICABLE');
 const now=new Date().toISOString();const result=await db.batch([
  db.prepare(`UPDATE commerce_decisions SET state=?,revision=revision+1,outcome_publication_id=?,outcome_note=?,updated_at=?
   WHERE tenant_id=? AND id=? AND revision=? AND EXISTS (SELECT 1 FROM tenant_identity WHERE tenant_id=? AND route_epoch=?)
    AND (? IS NULL OR EXISTS (SELECT 1 FROM commerce_heads WHERE tenant_id=? AND active_publication_id=?))
    AND NOT EXISTS (SELECT 1 FROM (${invalidPublicationSources}) x WHERE x.tenant_id=? AND (x.publication_id=? OR x.publication_id=?))`)
   .bind(state,outcome,note,now,ctx.id,decisionId,expected,ctx.id,ctx.routeEpoch,outcome,ctx.id,outcome,ctx.id,prior.publication_id,outcome),
  db.prepare('INSERT INTO commerce_decision_events SELECT ?,?,?,?,?,?,?,?,? WHERE changes()=1').bind(ctx.id,decisionId,expected+1,prior.state,state,ctx.principal.subject,note,outcome,now),
  db.prepare('INSERT INTO audit_events SELECT ?,?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),ctx.id,ctx.principal.subject,'commerce.decision-'+state.toLowerCase(),decisionId,now)
 ]);
 if(result[0]?.meta.changes!==1)throw new AppError(409,'REVISION_CONFLICT');return {decisionId,state,revision:expected+1,externalActionExecuted:false,recordedRecovery:'0',outcomeBasis:state==='RESOLVED'?'observed-condition-cleared':null};
}
export async function readCommerceDecisions(ctx:TenantContext,decisionId?:string){
 commerceOwner(ctx);const target=decisionId?id(decisionId):null,db=database(ctx),results=await db.batch([
 db.prepare(`SELECT d.*,
  EXISTS (SELECT 1 FROM (${invalidPublicationSources}) x WHERE x.tenant_id=d.tenant_id
    AND (x.publication_id=d.publication_id OR x.publication_id=d.outcome_publication_id)) AS evidence_revoked
  FROM commerce_decisions d WHERE d.tenant_id=? AND (? IS NULL OR d.id=?) ORDER BY d.updated_at DESC,d.id DESC LIMIT 50`).bind(ctx.id,target,target),
 db.prepare('SELECT revision,from_state,to_state,actor_subject,note,evidence_publication_id,occurred_at FROM commerce_decision_events WHERE tenant_id=? AND decision_id=? ORDER BY revision DESC LIMIT 51').bind(ctx.id,target)
 ]);
 if(results.some(r=>!r.success))throw new AppError(503,'DECISION_UNAVAILABLE');const rows=results[0]!.results,history=results[1]!.results;
 if(decisionId&&!rows.length)throw new AppError(404,'DECISION_NOT_FOUND');
 if(rows.some(r=>r.evidence_revoked))throw new AppError(503,'PUBLICATION_SOURCE_REVOKED');
 return {events:decisionId?history.slice(0,50):undefined,historyTruncated:history.length>50,decisions:rows.map(r=>({...r,finding:JSON.parse(String(r.finding_json)),finding_json:undefined,evidence_revoked:undefined})),limit:50};
}
export async function exportCommerceReport(ctx:TenantContext,publicationId:string,format:string){
 if(!['csv','json'].includes(format))throw new AppError(400,'EXPORT_FORMAT_UNSUPPORTED');
 const data=await readCommercePublication(ctx,id(publicationId));if(!data.publication)throw new AppError(404,'PUBLICATION_NOT_FOUND');
 const {report,contentHash}=data.publication;
 const content=format==='csv'?commerceSummaryCsv(report,publicationId,contentHash):JSON.stringify({publicationId,contentHash,report},null,2);
 return new Response(content,{headers:{'Content-Type':format==='csv'?'text/csv; charset=utf-8':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="lumi-${publicationId}.${format}"`}});
}
