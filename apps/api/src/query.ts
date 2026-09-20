import {AppError,object,sha256,type Query} from '../../../packages/core/contracts.ts';
import {compileQuery,parseQuery,type Dashboard} from '../../../packages/core/semantics.ts';
import type {TenantContext} from './tenant.ts';

export function assertMetricScope(ctx:TenantContext,metrics:readonly string[]):void {
  if(ctx.active && metrics.some(m=>!ctx.active!.pack.allowedMetrics.includes(m))) {
    throw new AppError(403,'PACK_METRIC_DENIED');
  }
}
export function assertDashboardScope(ctx:TenantContext,definition:Dashboard):void {
  for(const widget of definition.widgets)assertMetricScope(ctx,widget.metrics);
}
export function parseBatch(value:unknown,ctx:TenantContext):Query[] {
  const body=object(value,['queries','configurationRelease','configurationRevision']);
  if(!Array.isArray(body.queries)||body.queries.length<1||body.queries.length>12)throw new AppError(400,'QUERY_BATCH_LIMIT');
  if(body.configurationRelease!==(ctx.active?.releaseId??'builtin') || body.configurationRevision!==(ctx.active?.revision??0)) {
    throw new AppError(409,'CONFIGURATION_CHANGED');
  }
  return body.queries.map(parseQuery);
}
/** One admitted request, one configuration release, one transactional D1 read batch.
 * This is a known snapshot vector, NOT a globally atomic view of upstream systems.
 */
export async function executeQueries(ctx:TenantContext,queries:Query[]) {
  const plans=queries.map(q=>{assertMetricScope(ctx,q.metrics);return compileQuery(q,ctx.id);});
  const db=ctx.db.withSession?ctx.db.withSession('first-primary'):ctx.db;
  const rows=await db.batch([
    db.prepare(`SELECT s.id AS source_id,p.id,p.content_hash,p.observed_through,p.ingested_at
      FROM sources s LEFT JOIN active_snapshots a ON a.tenant_id=s.tenant_id AND a.source_id=s.id
      LEFT JOIN snapshots p ON p.tenant_id=a.tenant_id AND p.id=a.snapshot_id
      WHERE s.tenant_id=? AND s.state='active' ORDER BY s.id LIMIT 21`).bind(ctx.id),
    ...plans.map(p=>db.prepare(p.sql).bind(...p.params))
  ]);
  if(rows.length!==queries.length+1 || rows.some(r=>!r.success))throw new AppError(503,'QUERY_UNAVAILABLE');
  const sources=rows[0]!.results;
  if(sources.length>20 || rows.slice(1).some(r=>r.results.length>200))throw new AppError(422,'RESULT_BUDGET_EXCEEDED');
  const provenance=sources.filter(s=>s.id!==null);
  const missingSources=sources.filter(s=>s.id===null).map(s=>s.source_id);
  const scopeDigest=await sha256(JSON.stringify([ctx.principal.issuer,ctx.principal.subject,ctx.role,ctx.features,ctx.active?.pack.allowedMetrics??'builtin']));
  const context={tenantId:ctx.id,routeEpoch:ctx.routeEpoch,scopeDigest,
    configurationRelease:ctx.active?.releaseId??'builtin',configurationRevision:ctx.active?.revision??0,
    definitionVersion:'operations-v1',reportingTimezone:'Asia/Ho_Chi_Minh',currency:'VND',
    snapshotVector:provenance.map(s=>({sourceId:s.source_id,snapshotId:s.id,contentHash:s.content_hash})),
    windows:queries.map(q=>[q.from,q.to])};
  const contextHash=await sha256(JSON.stringify(context));
  const generatedAt=new Date().toISOString();
  const results=queries.map((query,i)=>{
    // observed_through is a business date. The requested range is upper-exclusive.
    const requiredThrough=new Date(Date.parse(query.to)-86_400_000).toISOString().slice(0,10);
    const behind=provenance.filter(s=>String(s.observed_through)<requiredThrough).map(s=>s.source_id);
    const qualityState=provenance.length===0?'NO_PUBLISHED_DATA':missingSources.length?'MISSING_SOURCE':behind.length?'BEHIND_REQUESTED_PERIOD':'COVERAGE_UNVERIFIED';
    return {data:rows[i+1]!.results,meta:{...context,contextHash,from:query.from,toExclusive:query.to,
      provenance,sourceCount:provenance.length,expectedSourceCount:sources.length,missingSources,
      noPublishedData:provenance.length===0,qualityState,behindRequestedPeriod:behind,generatedAt,
      sourceCompletenessCertified:false,rowsRead:rows[i+1]!.meta.rows_read??null,
      caveat:'Released hours are capacity, not cash savings. Transport success and zero values do not prove complete source coverage.'}};
  });
  if(new TextEncoder().encode(JSON.stringify(results)).byteLength>512_000)throw new AppError(422,'RESULT_BUDGET_EXCEEDED');
  return {context,contextHash,results};
}
