import {AppError,day,id,object,sha256,text} from './contracts.ts';
import {commerceFindings,findingResolved,commerceSummaryCsv,DETECTOR_VERSION,type CommerceFinding} from './commerce-insights.ts';
import {invalidPublicationSources} from './commerce-evidence.ts';
import {commerceOwner} from './commerce-normalization.ts';
import {readCommercePublication} from './commerce-publication.ts';
import type {InstallationUser} from './installation-auth.ts';
import type {Database} from './ports.ts';
const database=(db:Database)=>db.withSession?db.withSession('first-primary'):db;
export async function readCommerceInsightFindings(db:Database,actor:InstallationUser){
 const data=await readCommercePublication(db,actor);return {publicationId:data.publication?.id??null,detectorVersion:DETECTOR_VERSION,findings:data.publication?commerceFindings(data.publication.report):[],noPublishedData:data.noPublishedData,autonomousActionsEnabled:false};
}
export async function createCommerceDecision(db:Database,actor:InstallationUser,value:unknown){
 commerceOwner(actor);const b=object(value,['publicationId','findingId','rationale','dueOn']),publicationId=id(b.publicationId),findingId=text(b.findingId,128),rationale=text(b.rationale,1000),dueOn=b.dueOn===null||b.dueOn===undefined?null:day(b.dueOn);
 const current=await readCommercePublication(db,actor,publicationId);
 if(current.activePublicationId!==publicationId||!current.publication)throw new AppError(409,'DECISION_REQUIRES_CURRENT_EVIDENCE');
 const finding=commerceFindings(current.publication.report).find(f=>f.id===findingId);if(!finding)throw new AppError(404,'FINDING_NOT_FOUND');
 const decisionId='cd_'+(await sha256(JSON.stringify([findingId]))).slice(0,48),d=database(db),now=new Date().toISOString();
 const result=await d.batch([
  d.prepare(`INSERT INTO commerce_decisions
   (id,publication_id,finding_id,finding_json,detector_version,owner_user_id,rationale,due_on,state,revision,outcome_publication_id,outcome_note,created_at,updated_at)
   SELECT ?,?,?,?,?,?,?,?,'OPEN',1,NULL,NULL,?,? WHERE EXISTS
    (SELECT 1 FROM commerce_heads WHERE singleton=1 AND active_publication_id=?)
   AND NOT EXISTS (SELECT 1 FROM (${invalidPublicationSources}) x WHERE x.publication_id=?)
   ON CONFLICT(finding_id) DO NOTHING`)
   .bind(decisionId,publicationId,findingId,JSON.stringify(finding),DETECTOR_VERSION,actor.id,rationale,dueOn,now,now,publicationId,publicationId),
  d.prepare("INSERT INTO commerce_decision_events (decision_id,revision,from_state,to_state,actor,note,evidence_publication_id,occurred_at) SELECT ?,1,NULL,'OPEN',?,?,?,? WHERE changes()=1").bind(decisionId,actor.id,rationale,publicationId,now),
  d.prepare('INSERT INTO audit_events (id,actor,event_type,resource_id,occurred_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),actor.id,'commerce.decision-opened',decisionId,now)
 ]);
 const row=await d.prepare('SELECT id,state,revision FROM commerce_decisions WHERE id=?').bind(decisionId).first<{id:string;state:string;revision:number}>();
 if(!row)throw new AppError(409,'DECISION_EVIDENCE_CHANGED');
 if(['RESOLVED','ACCEPTED_LIMITATION'].includes(row.state))throw new AppError(409,'RECURRENCE_REVIEW_REQUIRED');
 return {...row,replayed:result[0]?.meta.changes!==1,externalActionExecuted:false};
}
export async function updateCommerceDecision(db:Database,actor:InstallationUser,decisionId:string,value:unknown,expected:number){
 commerceOwner(actor);const b=object(value,['state','note','outcomePublicationId']),state=text(b.state,32),note=text(b.note,1000),outcome=b.outcomePublicationId===null||b.outcomePublicationId===undefined?null:id(b.outcomePublicationId),d=database(db);
 const prior=await d.prepare('SELECT state,publication_id,finding_json,revision FROM commerce_decisions WHERE id=?').bind(id(decisionId)).first<{state:string;publication_id:string;finding_json:string;revision:number}>();
 if(!prior)throw new AppError(404,'DECISION_NOT_FOUND');
 const transitions:Record<string,string[]>={OPEN:['INVESTIGATING','ACCEPTED_LIMITATION'],INVESTIGATING:['AWAITING_OUTCOME','ACCEPTED_LIMITATION'],AWAITING_OUTCOME:['INVESTIGATING','RESOLVED','ACCEPTED_LIMITATION']};
 if(!transitions[prior.state]?.includes(state))throw new AppError(409,'INVALID_DECISION_TRANSITION');
 if(prior.revision!==expected)throw new AppError(409,'REVISION_CONFLICT');
 if(state==='RESOLVED'){
  if(!outcome||outcome===prior.publication_id)throw new AppError(409,'NEW_OUTCOME_EVIDENCE_REQUIRED');
  const [baseline,next]=await Promise.all([readCommercePublication(db,actor,prior.publication_id),readCommercePublication(db,actor,outcome)]);
  const finding=JSON.parse(prior.finding_json) as CommerceFinding;
  if(!baseline.publication||!next.publication||next.activePublicationId!==outcome||JSON.stringify(baseline.publication.report.window)!==JSON.stringify(next.publication.report.window)||baseline.publication.mappingId!==next.publication.mappingId||baseline.publication.report.semanticVersion!==next.publication.report.semanticVersion||baseline.publication.report.taxBasis!==next.publication.report.taxBasis||!findingResolved(next.publication.report,finding))throw new AppError(409,'OUTCOME_NOT_OBSERVED');
 }else if(outcome!==null)throw new AppError(400,'OUTCOME_NOT_APPLICABLE');
 const now=new Date().toISOString();const result=await d.batch([
  d.prepare(`UPDATE commerce_decisions SET state=?,revision=revision+1,outcome_publication_id=?,outcome_note=?,updated_at=?
   WHERE id=? AND revision=?
    AND (? IS NULL OR EXISTS (SELECT 1 FROM commerce_heads WHERE singleton=1 AND active_publication_id=?))
    AND NOT EXISTS (SELECT 1 FROM (${invalidPublicationSources}) x WHERE x.publication_id=? OR x.publication_id=?)`)
   .bind(state,outcome,note,now,id(decisionId),expected,outcome,outcome,prior.publication_id,outcome),
  d.prepare('INSERT INTO commerce_decision_events (decision_id,revision,from_state,to_state,actor,note,evidence_publication_id,occurred_at) SELECT ?,?,?,?,?,?,?,? WHERE changes()=1').bind(id(decisionId),expected+1,prior.state,state,actor.id,note,outcome,now),
  d.prepare('INSERT INTO audit_events (id,actor,event_type,resource_id,occurred_at) SELECT ?,?,?,?,? WHERE changes()=1').bind(crypto.randomUUID(),actor.id,'commerce.decision-'+state.toLowerCase(),id(decisionId),now)
 ]);
 if(result[0]?.meta.changes!==1)throw new AppError(409,'REVISION_CONFLICT');return {decisionId,state,revision:expected+1,externalActionExecuted:false,recordedRecovery:'0',outcomeBasis:state==='RESOLVED'?'observed-condition-cleared':null};
}
export async function readCommerceDecisions(db:Database,actor:InstallationUser,decisionId?:string){
 commerceOwner(actor);const target=decisionId?id(decisionId):null,d=database(db),results=await d.batch([
 d.prepare(`SELECT d.*,
  EXISTS (SELECT 1 FROM (${invalidPublicationSources}) x
    WHERE x.publication_id=d.publication_id OR x.publication_id=d.outcome_publication_id) AS evidence_revoked
  FROM commerce_decisions d WHERE (? IS NULL OR d.id=?) ORDER BY d.updated_at DESC,d.id DESC LIMIT 50`).bind(target,target),
 d.prepare('SELECT revision,from_state,to_state,actor,note,evidence_publication_id,occurred_at FROM commerce_decision_events WHERE decision_id=? ORDER BY revision DESC LIMIT 51').bind(target)
 ]);
 if(results.some(r=>!r.success))throw new AppError(503,'DECISION_UNAVAILABLE');const rows=results[0]!.results,history=results[1]!.results;
 if(decisionId&&!rows.length)throw new AppError(404,'DECISION_NOT_FOUND');
 if(rows.some(r=>r.evidence_revoked))throw new AppError(503,'PUBLICATION_SOURCE_REVOKED');
 return {events:decisionId?history.slice(0,50):undefined,historyTruncated:history.length>50,decisions:rows.map(r=>({...r,finding:JSON.parse(String(r.finding_json)),finding_json:undefined,evidence_revoked:undefined})),limit:50};
}
export async function exportCommerceReport(db:Database,actor:InstallationUser,publicationId:string,format:string){
 if(!['csv','json'].includes(format))throw new AppError(400,'EXPORT_FORMAT_UNSUPPORTED');
 const data=await readCommercePublication(db,actor,id(publicationId));if(!data.publication)throw new AppError(404,'PUBLICATION_NOT_FOUND');
 const {report,contentHash}=data.publication;
 const content=format==='csv'?commerceSummaryCsv(report,publicationId,contentHash):JSON.stringify({publicationId,contentHash,report},null,2);
 return new Response(content,{headers:{'Content-Type':format==='csv'?'text/csv; charset=utf-8':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="lumi-${publicationId}.${format}"`}});
}
