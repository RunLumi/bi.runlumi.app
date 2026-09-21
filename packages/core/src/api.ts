import {readCommerceInsights,createCommerceDecision,updateCommerceDecision,readCommerceDecisions,exportCommerceReport} from './commerce-decisions.ts';
import {revision as requireRevision} from './http.ts';
import {readCommerceConnections,createCommerceConnection,changeCommerceConnection} from './commerce-connections.ts';
import {registerCommerceMapping,previewCommercePublication,publishCommerce,readCommercePublication,readCommerceQueryPublication,readCommercePublicationStatus} from './commerce-publication.ts';
import {normalizeCommerceReceipt,readCommerceNormalizations,readCommerceStaging} from './commerce-normalization.ts';
import {acceptCommerceExport,readCommerceReceipts} from './commerce-receipts.ts';
import {commerceReadiness} from './commerce-readiness.ts';
import {assertDashboardScope,parseBatch,executeQueries} from './query.ts';
import {controlRequest,controlScope} from './control-client.ts';
import { AppError, id, object, parseSnapshot, sha256, type Principal, type Query } from './contracts.ts';
import { metrics, parseQuery, parseDashboard } from './semantics.ts';
import { assertCommerceMetricScope, commerceMetricCatalog, parseCommerceQuery, queryCommerceReport } from './commerce-query.ts';
import { readCommerceCapabilities, reviewCommerceCapability } from './commerce-capabilities.ts';
import { enqueueCommerceJob, executeCommerceJob, readCommerceJob, readCommerceJobs } from './commerce-jobs.ts';
import { authorizeTenant, canEdit } from './tenant.ts';
import { importSnapshot } from './ingest.ts';
import {CORE_MODULES,parseDecisionRules,type CoreModule,type DecisionRule} from './extension-contracts.ts';
import {createCommerceInsight,readCommerceInsightsArtifacts,refreshCommerceInsight} from './commerce-insight-artifacts.ts';
import { LUMI_CORE_VERSION } from './version.ts';
import type { AppEnv } from './ports.ts';
export type Authenticate<E extends AppEnv = AppEnv> = (request:Request,env:E)=>Promise<Principal>;
export interface CustomMetricResult { value: string|null; unit: string; evidence: unknown }
export interface CustomMetricContext { request: Request; tenant: import('./tenant.ts').TenantContext; query: (query: Query)=>ReturnType<typeof executeQueries> }
export interface CustomMetricExtension { id: string; version: number; execute: (context: CustomMetricContext)=>Promise<CustomMetricResult> }
/** Server-side source export contract. Adapters run inside the customer worker under
 * reviewed code. The pull request is always server-constructed from deployment
 * configuration: a browser or model never supplies connection ids, windows,
 * watermarks or credentials. */
export type ConnectorResourceType='orders'|'settlements'|'inventory'|'workflow_facts';
export interface ConnectorPullRequest {
  connectionId: string;
  resourceType: ConnectorResourceType;
  window: {from:string; toExclusive:string};
  observedAt: string;
}
export interface ConnectorAdapter {
  provider: string;
  /** Declared resource types this adapter may produce. */
  resources: readonly ConnectorResourceType[];
  /** Server-side transport. Must be a supported, certified transport; not arbitrary fetch. */
  transport: 'authorized-export';
  /** Returns a raw export envelope body for the core snapshot pipeline. */
  pull(request: ConnectorPullRequest): Promise<unknown>;
}
export interface ApiOptions {
  customMetrics?: readonly CustomMetricExtension[];
  connectors?: readonly ConnectorAdapter[];
  decisionRules?: readonly DecisionRule[];
  /** Enabled product modules from the customer manifest. When present, routes whose
   * family is not enabled are rejected server-side (403 MODULE_DISABLED). */
  modules?: readonly CoreModule[];
}
/** Server-owned pull window. A reviewed adapter build defines the real operational
 * range; the API never trusts a browser-suggested horizon. */
const PULL_WINDOW={from:'2026-09-01',toExclusive:'2026-10-01'} as const;
/** Validate extension composition synchronously so a misconfigured worker fails
 * closed at startup rather than on first request. */
function validateComposition(options:ApiOptions):void{
  if(options.decisionRules!==undefined)parseDecisionRules(options.decisionRules);
  if(options.modules!==undefined&&(!Array.isArray(options.modules)||!options.modules.length||options.modules.some(m=>!CORE_MODULES.includes(m as CoreModule))))throw new AppError(500,'INVALID_MODULE_CONFIG');
  for(const connector of options.connectors??[]){
   if(!connector||typeof connector!=='object'||typeof connector.provider!=='string'||!/^[a-z][a-z0-9-]{0,62}$/.test(connector.provider))throw new AppError(500,'INVALID_CONNECTOR_PROVIDER');
   if(!Array.isArray(connector.resources)||!connector.resources.length||!connector.resources.every(r=>['orders','settlements','inventory','workflow_facts'].includes(r as ConnectorResourceType)))throw new AppError(500,'INVALID_CONNECTOR_RESOURCES');
   if(connector.transport!=='authorized-export')throw new AppError(500,'UNSUPPORTED_CONNECTOR_TRANSPORT');
   if(typeof connector.pull!=='function')throw new AppError(500,'INVALID_CONNECTOR_PULL');
  }
}
const MAX_BODY=65536;
async function readJson(request:Request):Promise<unknown> {
  if(request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase() !== 'application/json') throw new AppError(415,'JSON_REQUIRED');
  const declared=request.headers.get('content-length');
  if(declared!==null && (!/^\d+$/.test(declared) || Number(declared)>MAX_BODY)) throw new AppError(413,'BODY_TOO_LARGE');
  if(!request.body) throw new AppError(400,'BODY_REQUIRED');
  const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;
  while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();throw new AppError(413,'BODY_TOO_LARGE');}chunks.push(value);}
  const all=new Uint8Array(size);let offset=0;for(const x of chunks){all.set(x,offset);offset+=x.length;}
  try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all));}catch{throw new AppError(400,'INVALID_JSON');}
}
function json(value:unknown,status=200):Response{return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8'}});}
function secure(response:Response,requestId:string):Response {
  const r=new Response(response.body,response);
  r.headers.set('Cache-Control','private, no-store');
  r.headers.set('X-Content-Type-Options','nosniff');
  r.headers.set('Referrer-Policy','no-referrer');
  r.headers.set('X-Request-ID',requestId);
  return r;
}
export function createApi<E extends AppEnv = AppEnv>(authenticate:Authenticate<E>, demo=false, options:ApiOptions={}) {
  validateComposition(options);
  return async(request:Request,env:E):Promise<Response>=>{
    const requestId=crypto.randomUUID();
    try {
      const url=new URL(request.url);
      if(url.pathname==='/healthz')return secure(json({status:'ok',version:LUMI_CORE_VERSION,productionReady:false}),requestId);
      if(!url.pathname.startsWith('/api/')) return new Response('Not found',{status:404});
      if(!['GET','POST','PUT'].includes(request.method))throw new AppError(405,'METHOD_NOT_ALLOWED');
      if(request.method!=='GET'){
        const origin=request.headers.get('origin');
        if((origin && origin!==url.origin) || request.headers.get('sec-fetch-site')==='cross-site')throw new AppError(403,'CROSS_ORIGIN_DENIED');
      }
      const principal=await authenticate(request,env);
      if(url.pathname==='/api/session' && request.method==='GET'){
        const response=await controlRequest(env.CONTROL,request,'/control/session',controlScope(env),undefined,demo);
        const body=await response.json() as {tenants:{cell_id:string;id:string}[];platformOperator:boolean};
        // Dedicated deployments expose exactly their configured customer; cells filter by cell.
        return secure(json({...body,demo,tenants:body.tenants.filter(t=>t.cell_id===env.CELL_ID&&(!env.CUSTOMER_ID||t.id===env.CUSTOMER_ID))}),requestId);
      }
      if(url.pathname.startsWith('/api/control/')){
        // Fleet administration is served from the control/cell surface only. A
        // dedicated customer deployment must not proxy unrestricted admin calls.
        if(env.CUSTOMER_ID!==undefined)throw new AppError(403,'CONTROL_ADMIN_DENIED');
        const body=request.method==='GET'?undefined:await readJson(request);
        return secure(await controlRequest(env.CONTROL,request,url.pathname.replace('/api/control/','/control/admin/'),controlScope(env),body,demo),requestId);
      }
      const match=/^\/api\/tenants\/([a-z0-9_-]{1,64})\/(metrics|query|query-batch|custom-metrics|connector-pull|custom-rules|commerce-metrics|commerce-query|commerce-capabilities|commerce-jobs|dashboards|imports|configuration|readiness|commerce-receipts|commerce-normalizations|commerce-mappings|commerce-publications|commerce-connections|commerce-insights|commerce-decisions|commerce-exports|commerce-staging)(?:\/([a-z0-9_.-]{1,128}))?$/.exec(url.pathname);
      if(!match)throw new AppError(404,'NOT_FOUND');
      const tenantId=id(match[1]);const route=match[2];const resource=match[3];
      // Module enablement gates server behavior, never just nav links. A route whose
      // family is disabled is rejected before tenant authorization is even attempted.
      if(options.modules){
        const family:CoreModule|undefined=route?.startsWith('commerce-')?'commerce':['metrics','query','query-batch','dashboards','imports','custom-metrics','connector-pull','custom-rules'].includes(route??'') ? 'operations' : undefined;
        if(family&&!options.modules.includes(family))throw new AppError(403,'MODULE_DISABLED');
      }
      const feature=['commerce-receipts','commerce-normalizations','commerce-mappings','commerce-publications','commerce-connections','commerce-capabilities','commerce-jobs','commerce-insights','commerce-decisions','commerce-exports','commerce-staging'].includes(route??'')?'data.import':route==='imports'&&request.method==='POST'?'data.import':route==='connector-pull'&&request.method==='POST'?'data.import':route==='dashboards'&&request.method!=='GET'?'dashboard.edit':'bi.read';
      const ctx=await authorizeTenant(env,principal,tenantId,request,feature,demo);
      const active=ctx.active;
      if(route==='custom-metrics'&&request.method==='GET'&&resource){
        const extension=options.customMetrics?.find(item=>item.id===resource);
        if(!extension)throw new AppError(404,'CUSTOM_METRIC_NOT_FOUND');
        const result=await extension.execute({request,tenant:ctx,query:(query)=>executeQueries(ctx,[query])});
        return secure(json({id:extension.id,version:extension.version,...result,scope:{tenantId:ctx.id,role:ctx.role},coreVersion:LUMI_CORE_VERSION}),requestId);
      }
      if(route==='custom-rules'&&request.method==='GET'&&!resource){
        // Read-only advisory catalog. Rules are reviewed definitions; they never
        // execute external actions. No writer exists: POST/PUT fall to 404.
        return secure(json({version:'operations-v1',rules:options.decisionRules??[],scope:{tenantId:ctx.id,role:ctx.role},coreVersion:LUMI_CORE_VERSION}),requestId);
      }
      if(route==='connector-pull'&&request.method==='POST'){
        // The pull request is server-constructed from reviewed deployment config;
        // a browser or model never supplies connection ids, windows, watermarks
        // or credentials. The envelope flows through the same snapshot pipeline as
        // a reviewed import, with a deterministic idempotency key per pull.
        const adapter=resource?(options.connectors??[]).find(item=>item.provider===resource):undefined;
        if(!adapter)throw new AppError(404,'CONNECTOR_NOT_FOUND');
        const envelope=await adapter.pull({connectionId:'customer-deployment',resourceType:adapter.resources[0]??'workflow_facts',window:{from:PULL_WINDOW.from,toExclusive:PULL_WINDOW.toExclusive},observedAt:new Date().toISOString()});
        const snapshot=parseSnapshot(envelope);
        const result=await importSnapshot(env,ctx,snapshot,`pull-${adapter.provider}-${snapshot.observedThrough}`);
        return secure(json({...result,provider:adapter.provider,sourceId:snapshot.sourceId,recordCount:snapshot.records.length,observedThrough:snapshot.observedThrough},result.replayed?200:201),requestId);
      }
      if(route==='configuration'&&request.method==='GET'&&!resource)return secure(json({active:active?{releaseId:active.releaseId,revision:active.revision,sourceCommit:active.sourceCommit,provenance:active.provenance,attestationVerified:active.attestationVerified,name:active.pack.name,queries:active.pack.queries,ai:{enabled:active.pack.ai.enabled,providerInstanceRef:active.pack.ai.providerInstanceRef,modelRef:active.pack.ai.modelRef,dailyBudgetUsd:active.pack.ai.dailyBudgetUsd,inferenceImplemented:false}}:null}),requestId);
      if(route==='readiness'&&request.method==='GET'&&!resource)return secure(json(commerceReadiness),requestId);
      if(route==='commerce-metrics'&&request.method==='GET'&&!resource)return secure(json({contract:'lumi.query.v1',semanticRelease:'commerce-cohort-v1.0.0',metrics:commerceMetricCatalog(ctx.role==='owner')}),requestId);
      if(route==='commerce-query'&&request.method==='POST'&&!resource){
        const query=parseCommerceQuery(await readJson(request));
        assertCommerceMetricScope(ctx.role,query.metrics);const publication=await readCommerceQueryPublication(ctx,query.dataVersion);
        if(publication.id!==query.dataVersion)throw new AppError(409,'COMMERCE_DATA_VERSION_NOT_ACTIVE');
        const contextHash=await sha256(JSON.stringify([ctx.id,ctx.routeEpoch,publication.id,ctx.role,ctx.principal.subject]));
        return secure(json({queryId:crypto.randomUUID(),contract:query.contract,semanticRelease:'commerce-cohort-v1.0.0',dataVersion:publication.id,contextHash,metrics:queryCommerceReport(publication.report,query),quality:{state:publication.report.qualityState,warnings:publication.report.warnings,sourceCompletenessCertified:publication.report.sourceCompletenessCertified},scope:{tenantId:ctx.id,role:ctx.role,description:'current authorized tenant scope; sensitive financial fields require owner role'},lineage:{publicationId:publication.id,contentHash:publication.contentHash,sourceCount:publication.report.sources.length}}),requestId);
      }
      if(route==='commerce-capabilities'&&request.method==='GET'&&!resource)return secure(json(await readCommerceCapabilities(ctx)),requestId);
      if(route==='commerce-jobs'&&request.method==='GET'&&!resource)return secure(json(await readCommerceJobs(ctx)),requestId);
      if(route==='commerce-jobs'&&request.method==='GET'&&resource)return secure(json(await readCommerceJob(ctx,resource)),requestId);
      let response:Response;
      if(route==='commerce-staging'&&request.method==='GET'&&resource){
        response=json(await readCommerceStaging(ctx,resource));
      }else if(route==='commerce-insights'&&request.method==='GET'){
        if(resource) response=json(await readCommerceInsightsArtifacts(ctx,resource));
        else {const findings=await readCommerceInsights(ctx);response=json({...findings,artifacts:[]});}
      }else if(route==='commerce-insights'&&request.method==='POST'&&!resource){
        response=json(await createCommerceInsight(ctx,await readJson(request)),201);
      }else if(route==='commerce-insights'&&request.method==='PUT'&&resource){
        response=json(await refreshCommerceInsight(ctx,resource,await readJson(request)));
      }else if(route==='commerce-decisions'&&request.method==='GET'){
        response=json(await readCommerceDecisions(ctx,resource));
      }else if(route==='commerce-decisions'&&request.method==='POST'&&!resource){
        response=json(await createCommerceDecision(ctx,await readJson(request)),201);
      }else if(route==='commerce-decisions'&&request.method==='PUT'&&resource){
        response=json(await updateCommerceDecision(ctx,resource,await readJson(request),requireRevision(request)));
      }else if(route==='commerce-exports'&&request.method==='GET'&&resource){
        url.searchParams.forEach((_value,key)=>{if(key!=='format')throw new AppError(400,'UNKNOWN_EXPORT_OPTION');});
        response=await exportCommerceReport(ctx,resource,url.searchParams.get('format')??'csv');
      }else if(route==='commerce-connections'&&request.method==='GET'&&!resource){
        response=json(await readCommerceConnections(ctx));
      }else if(route==='commerce-connections'&&request.method==='POST'&&!resource){
        response=json(await createCommerceConnection(ctx,await readJson(request)),201);
      }else if(route==='commerce-connections'&&request.method==='PUT'&&resource){
        response=json(await changeCommerceConnection(ctx,resource,await readJson(request),requireRevision(request)));
      }else if(route==='commerce-capabilities'&&request.method==='POST'&&!resource){
        response=json(await reviewCommerceCapability(ctx,await readJson(request)),201);
      }else if(route==='commerce-jobs'&&request.method==='POST'&&!resource){
        response=json(await enqueueCommerceJob(ctx,await readJson(request)),202);
      }else if(route==='commerce-jobs'&&request.method==='POST'&&resource){
        response=json(await executeCommerceJob(ctx,resource,env.SOURCES));
      }else if(route==='commerce-mappings'&&request.method==='POST'&&!resource){
        response=json(await registerCommerceMapping(ctx,await readJson(request)));
      }else if(route==='commerce-publications'&&request.method==='POST'&&resource==='preview'){
        response=json(await previewCommercePublication(ctx,await readJson(request)));
      }else if(route==='commerce-publications'&&request.method==='POST'&&!resource){
        response=json(await publishCommerce(ctx,await readJson(request)),201);
      }else if(route==='commerce-publications'&&request.method==='GET'&&resource==='status'){
        response=json(await readCommercePublicationStatus(ctx));
      }else if(route==='commerce-publications'&&request.method==='GET'){
        response=json(await readCommercePublication(ctx,resource));
      }else if(route==='commerce-normalizations'&&request.method==='POST'&&!resource){
        response=json(await normalizeCommerceReceipt(ctx,env.SOURCES,await readJson(request)));
      }else if(route==='commerce-normalizations'&&request.method==='GET'){
        response=json(await readCommerceNormalizations(ctx,resource));
      }else if(route==='commerce-receipts'&&request.method==='POST'&&!resource){
        const accepted=await acceptCommerceExport(ctx,env.SOURCES,await readJson(request));
        response=json(accepted,accepted.replayed?200:202);
      }else if(route==='commerce-receipts'&&request.method==='GET'){
        response=json(await readCommerceReceipts(ctx,resource));
      }else if(route==='metrics' && request.method==='GET' && !resource){
        response=json({version:'operations-v1',metrics:metrics.filter(m=>!active||active.pack.allowedMetrics.includes(m.id)).map(({expression,...m})=>m)});
      }else if(route==='query' && request.method==='POST' && !resource){
        response=json((await executeQueries(ctx,[parseQuery(await readJson(request))])).results[0]);
      }else if(route==='query-batch' && request.method==='POST' && !resource){
        response=json(await executeQueries(ctx,parseBatch(await readJson(request),ctx)));
      }else if(route==='dashboards' && request.method==='GET'){
        const gitDashboards=active?.pack.dashboards.map(d=>({...d,revision:active.revision,management:'git',releaseId:active.releaseId,configurationRelease:active.releaseId,configurationRevision:active.revision}))??[];
        if(resource&&gitDashboards.some(d=>d.id===resource)){const response=json({dashboards:gitDashboards.filter(d=>d.id===resource)});response.headers.set('ETag',`"${active!.revision}"`);return secure(response,requestId);}
        const result=resource
          ?await ctx.db.prepare('SELECT id,definition,revision FROM dashboards WHERE tenant_id=? AND id=?').bind(ctx.id,resource).all()
          :await ctx.db.prepare('SELECT id,definition,revision FROM dashboards WHERE tenant_id=? ORDER BY id LIMIT 50').bind(ctx.id).all();
        if(resource && !result.results.length)throw new AppError(404,'NOT_FOUND');
        response=json({dashboards:[...(resource?[]:gitDashboards),...result.results.filter(r=>!gitDashboards.some(d=>d.id===r.id)).map(r=>({id:r.id,revision:r.revision,management:'ui',configurationRelease:active?.releaseId??'builtin',configurationRevision:active?.revision??0,definition:parseDashboard(JSON.parse(String(r.definition)))}))]});
        if(resource)response.headers.set('ETag',`"${result.results[0]?.revision}"`);
      }else if(route==='dashboards' && request.method==='POST' && !resource){
        canEdit(ctx);const body=object(await readJson(request),['id','definition']);const dashboardId=id(body.id);if(active?.pack.dashboards.some(d=>d.id===dashboardId))throw new AppError(409,'GIT_MANAGED_DASHBOARD');const definition=parseDashboard(body.definition);assertDashboardScope(ctx,definition);const now=new Date().toISOString();
        const count=await ctx.db.prepare('SELECT COUNT(*) AS count FROM dashboards WHERE tenant_id=?').bind(ctx.id).first<{count:number}>();
        if((count?.count??0)>=50)throw new AppError(422,'DASHBOARD_QUOTA');
        try{await ctx.db.batch([ctx.db.prepare('INSERT INTO dashboards (tenant_id,id,definition,revision,updated_at) VALUES (?,?,?,1,?)').bind(ctx.id,dashboardId,JSON.stringify(definition),now),ctx.db.prepare('INSERT INTO audit_events (id,tenant_id,actor,event_type,resource_id,occurred_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),ctx.id,principal.subject,'dashboard.created',dashboardId,now)]);}
        catch(error){const prior=await ctx.db.prepare('SELECT id FROM dashboards WHERE tenant_id=? AND id=?').bind(ctx.id,dashboardId).first();if(prior)throw new AppError(409,'DASHBOARD_EXISTS');throw error;}
        response=json({id:dashboardId,revision:1,definition},201);
      }else if(route==='dashboards' && request.method==='PUT' && resource){
        canEdit(ctx);if(active?.pack.dashboards.some(d=>d.id===resource))throw new AppError(409,'GIT_MANAGED_DASHBOARD');const definition=parseDashboard(await readJson(request));assertDashboardScope(ctx,definition);
        const etag=request.headers.get('if-match');
        if(!etag || !/^"[1-9]\d{0,8}"$/.test(etag))throw new AppError(428,'REVISION_REQUIRED');
        const revision=Number(etag.slice(1,-1));const now=new Date().toISOString();
        const result=await ctx.db.batch([
          ctx.db.prepare('UPDATE dashboards SET definition=?,revision=revision+1,updated_at=? WHERE tenant_id=? AND id=? AND revision=?').bind(JSON.stringify(definition),now,ctx.id,resource,revision),
          ctx.db.prepare("INSERT INTO audit_events (id,tenant_id,actor,event_type,resource_id,occurred_at) SELECT ?,?,?,?,?,? WHERE changes()>0").bind(crypto.randomUUID(),ctx.id,principal.subject,'dashboard.updated',resource,now)
        ]);
        if(result[0]?.meta.changes!==1)throw new AppError(409,'REVISION_CONFLICT');
        response=json({id:resource,revision:revision+1,definition});response.headers.set('ETag',`"${revision+1}"`);
      }else if(route==='imports' && request.method==='POST' && !resource){
        response=json(await importSnapshot(env,ctx,parseSnapshot(await readJson(request)),request.headers.get('idempotency-key')??''),201);
      }else if(route==='imports' && request.method==='GET' && !resource){
        const result=await ctx.db.prepare('SELECT id,source_id,content_hash,observed_through,ingested_at,record_count FROM snapshots WHERE tenant_id=? ORDER BY ingested_at DESC LIMIT 50').bind(ctx.id).all();
        response=json({imports:result.results});
      }else{throw new AppError(404,'NOT_FOUND');}
      return secure(response,requestId);
    }catch(error){
      const appError=error instanceof AppError?error:new AppError(500,'INTERNAL_ERROR');
      // Never log JWTs, query text, row data, raw driver errors or customer headers.
      return secure(json({error:{code:appError.code,requestId}},appError.status),requestId);
    }
  };
}
