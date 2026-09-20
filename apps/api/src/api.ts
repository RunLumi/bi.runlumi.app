import {controlRequest} from './control-client.ts';
import { AppError, id, object, parseSnapshot, type Principal } from '../../../packages/core/contracts.ts';
import { metrics, parseQuery, compileQuery, parseDashboard } from '../../../packages/core/semantics.ts';
import { authorizeTenant, canEdit } from './tenant.ts';
import { importSnapshot } from './ingest.ts';
import type { Env } from './bindings.ts';
export type Authenticate = (request:Request,env:Env)=>Promise<Principal>;
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
export function createApi(authenticate:Authenticate, demo=false) {
  return async(request:Request,env:Env):Promise<Response>=>{
    const requestId=crypto.randomUUID();
    try {
      const url=new URL(request.url);
      if(url.pathname==='/healthz')return secure(json({status:'ok',version:'0.1.0',productionReady:false}),requestId);
      if(!url.pathname.startsWith('/api/')) return new Response('Not found',{status:404});
      if(!['GET','POST','PUT'].includes(request.method))throw new AppError(405,'METHOD_NOT_ALLOWED');
      if(request.method!=='GET'){
        const origin=request.headers.get('origin');
        if((origin && origin!==url.origin) || request.headers.get('sec-fetch-site')==='cross-site')throw new AppError(403,'CROSS_ORIGIN_DENIED');
      }
      const principal=await authenticate(request,env);
      if(url.pathname==='/api/session' && request.method==='GET'){
        const response=await controlRequest(env,request,'/control/session',undefined,demo);
        const body=await response.json() as {tenants:{cell_id:string}[];platformOperator:boolean};
        return secure(json({...body,demo,tenants:body.tenants.filter(t=>t.cell_id===env.CELL_ID)}),requestId);
      }
      if(url.pathname.startsWith('/api/control/')){
        const body=request.method==='GET'?undefined:await readJson(request);
        return secure(await controlRequest(env,request,url.pathname.replace('/api/control/','/control/admin/'),body,demo),requestId);
      }
      const match=/^\/api\/tenants\/([a-z0-9_-]{1,64})\/(metrics|query|dashboards|imports|configuration)(?:\/([a-z0-9_-]{1,64}))?$/.exec(url.pathname);
      if(!match)throw new AppError(404,'NOT_FOUND');
      const tenantId=id(match[1]);const route=match[2];const resource=match[3];
      const feature=route==='imports'&&request.method==='POST'?'data.import':route==='dashboards'&&request.method!=='GET'?'dashboard.edit':'bi.read';
      const ctx=await authorizeTenant(env,principal,tenantId,request,feature,demo);
      const active=ctx.active;
      if(route==='configuration'&&request.method==='GET'&&!resource)return secure(json({active:active?{releaseId:active.releaseId,revision:active.revision,sourceCommit:active.sourceCommit,name:active.pack.name,queries:active.pack.queries,ai:{enabled:active.pack.ai.enabled,providerInstanceRef:active.pack.ai.providerInstanceRef,modelRef:active.pack.ai.modelRef,dailyBudgetUsd:active.pack.ai.dailyBudgetUsd,inferenceImplemented:false}}:null}),requestId);
      let response:Response;
      if(route==='metrics' && request.method==='GET' && !resource){
        response=json({version:'operations-v1',metrics:metrics.filter(m=>!active||active.pack.allowedMetrics.includes(m.id)).map(({expression,...m})=>m)});
      }else if(route==='query' && request.method==='POST' && !resource){
        const query=parseQuery(await readJson(request));if(active&&query.metrics.some(m=>!active.pack.allowedMetrics.includes(m)))throw new AppError(403,'PACK_METRIC_DENIED');const compiled=compileQuery(query,ctx.id);
        // Atomic read batch keeps data and provenance on the same committed snapshot.
        const results=await ctx.db.batch([
          ctx.db.prepare('SELECT s.id,s.source_id,s.content_hash,s.observed_through,s.ingested_at FROM snapshots s JOIN active_snapshots a ON a.snapshot_id=s.id AND a.tenant_id=s.tenant_id WHERE s.tenant_id=? ORDER BY s.source_id LIMIT 21').bind(ctx.id),
          ctx.db.prepare(compiled.sql).bind(...compiled.params)
        ]);
        const provenance=results[0]?.results??[];const data=results[1]?.results??[];
        if(provenance.length>20 || data.length>200)throw new AppError(422,'RESULT_BUDGET_EXCEEDED');
        response=json({data,meta:{tenantId:ctx.id,configurationRelease:active?.releaseId??'builtin',definitionVersion:'operations-v1',from:query.from,toExclusive:query.to,reportingTimezone:'Asia/Ho_Chi_Minh',provenance,sourceCount:provenance.length,noPublishedData:provenance.length===0,generatedAt:new Date().toISOString(),rowsRead:results[1]?.meta.rows_read??null,caveat:'Released hours are capacity, not cash savings. Zero is not proof of complete source coverage.'}});
      }else if(route==='dashboards' && request.method==='GET'){
        const gitDashboards=active?.pack.dashboards.map(d=>({...d,revision:active.revision,management:'git',releaseId:active.releaseId}))??[];
        if(resource&&gitDashboards.some(d=>d.id===resource))return secure(json({dashboards:gitDashboards.filter(d=>d.id===resource)}),requestId);
        const result=resource
          ?await ctx.db.prepare('SELECT id,definition,revision FROM dashboards WHERE tenant_id=? AND id=?').bind(ctx.id,resource).all()
          :await ctx.db.prepare('SELECT id,definition,revision FROM dashboards WHERE tenant_id=? ORDER BY id LIMIT 50').bind(ctx.id).all();
        if(resource && !result.results.length)throw new AppError(404,'NOT_FOUND');
        response=json({dashboards:[...gitDashboards,...result.results.filter(r=>!gitDashboards.some(d=>d.id===r.id)).map(r=>({id:r.id,revision:r.revision,management:'ui',definition:parseDashboard(JSON.parse(String(r.definition)))}))]});
        if(resource)response.headers.set('ETag',`"${result.results[0]?.revision}"`);
      }else if(route==='dashboards' && request.method==='POST' && !resource){
        canEdit(ctx);const body=object(await readJson(request),['id','definition']);const dashboardId=id(body.id);if(active?.pack.dashboards.some(d=>d.id===dashboardId))throw new AppError(409,'GIT_MANAGED_DASHBOARD');const definition=parseDashboard(body.definition);const now=new Date().toISOString();
        const count=await ctx.db.prepare('SELECT COUNT(*) AS count FROM dashboards WHERE tenant_id=?').bind(ctx.id).first<{count:number}>();
        if((count?.count??0)>=50)throw new AppError(422,'DASHBOARD_QUOTA');
        try{await ctx.db.batch([ctx.db.prepare('INSERT INTO dashboards (tenant_id,id,definition,revision,updated_at) VALUES (?,?,?,1,?)').bind(ctx.id,dashboardId,JSON.stringify(definition),now),ctx.db.prepare('INSERT INTO audit_events (id,tenant_id,actor,event_type,resource_id,occurred_at) VALUES (?,?,?,?,?,?)').bind(crypto.randomUUID(),ctx.id,principal.subject,'dashboard.created',dashboardId,now)]);}
        catch(error){const prior=await ctx.db.prepare('SELECT id FROM dashboards WHERE tenant_id=? AND id=?').bind(ctx.id,dashboardId).first();if(prior)throw new AppError(409,'DASHBOARD_EXISTS');throw error;}
        response=json({id:dashboardId,revision:1,definition},201);
      }else if(route==='dashboards' && request.method==='PUT' && resource){
        canEdit(ctx);if(active?.pack.dashboards.some(d=>d.id===resource))throw new AppError(409,'GIT_MANAGED_DASHBOARD');const definition=parseDashboard(await readJson(request));
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
