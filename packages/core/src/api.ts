import {AppError,object,id,parseSnapshot,type Principal,type Role,type Query} from './contracts.ts';
import {metrics,parseQuery,parseDashboard,type Dashboard} from './semantics.ts';
import {executeInstallationQueries} from './query.ts';
import {importInstallationSnapshot} from './ingest.ts';
import {createInstallationSession,initializeInstallation,installationInitialized,readInstallationUser,requireInstallationRole,upsertInstallationUser,revokeInstallationSessions} from './installation-auth.ts';
import {LUMI_CORE_VERSION} from './version.ts';
import type {AppEnv,Database} from './ports.ts';
import type {CoreModule,DecisionRule} from './extension-contracts.ts';

export type Authenticate<E extends AppEnv=AppEnv>=(request:Request,env:E)=>Promise<Principal>;
export interface CustomMetricResult {value:string|null;unit:string;evidence:unknown}
export interface InstallationMetricContext {request:Request;db:Database;principal:Principal;role:Role;query:(query:Query)=>ReturnType<typeof executeInstallationQueries>}
export interface CustomMetricExtension {id:string;version:number;execute:(context:InstallationMetricContext)=>Promise<CustomMetricResult>}
export type ConnectorResourceType='orders'|'settlements'|'inventory'|'workflow_facts';
export interface ConnectorPullRequest {connectionId:string;resourceType:ConnectorResourceType;window:{from:string;toExclusive:string};observedAt:string}
export interface ConnectorAdapter {provider:string;resources:readonly ConnectorResourceType[];transport:'authorized-export';pull(request:ConnectorPullRequest):Promise<unknown>}
export interface ApiOptions {customMetrics?:readonly CustomMetricExtension[];connectors?:readonly ConnectorAdapter[];decisionRules?:readonly DecisionRule[];modules?:readonly CoreModule[];standalone?:boolean}
const MAX_BODY=65536;
async function readJson(request:Request):Promise<unknown>{
 if(request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()!=='application/json')throw new AppError(415,'JSON_REQUIRED');
 const declared=request.headers.get('content-length');if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>MAX_BODY))throw new AppError(413,'BODY_TOO_LARGE');if(!request.body)throw new AppError(400,'BODY_REQUIRED');
 const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();throw new AppError(413,'BODY_TOO_LARGE')}chunks.push(value)}const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length}try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all))}catch{throw new AppError(400,'INVALID_JSON')}
}
function json(value:unknown,status=200):Response{return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8'}})}
function secure(response:Response,requestId:string):Response{const out=new Response(response.body,response);out.headers.set('Cache-Control','private, no-store');out.headers.set('X-Content-Type','nosniff');out.headers.set('X-Request-ID',requestId);return out}
function dbFor<E extends AppEnv>(env:E):Database{const db=(env.DB??env.SERVING) as Database|undefined;if(!db||typeof db.prepare!=='function')throw new AppError(503,'INSTALLATION_DATABASE_UNAVAILABLE');return db}
function validateOptions(options:ApiOptions):void{for(const connector of options.connectors??[]){if(!/^[a-z][a-z0-9-]{0,62}$/.test(connector.provider)||connector.transport!=='authorized-export'||!connector.resources.length||typeof connector.pull!=='function')throw new AppError(500,'INVALID_CONNECTOR_CONFIG')}}
async function dashboardList(db:Database):Promise<unknown[]>{const rows=await db.prepare('SELECT id,definition,revision,updated_at AS updatedAt FROM dashboards ORDER BY id LIMIT 50').all();return rows.results.map(row=>({...row,definition:parseDashboard(JSON.parse(String(row.definition))),management:'ui'}))}

export function createApi<E extends AppEnv=AppEnv>(authenticate:Authenticate<E>,demo=false,options:ApiOptions={}):((request:Request,env:E)=>Promise<Response>){
 validateOptions(options);
 return async(request:Request,env:E):Promise<Response>=>{
  const requestId=crypto.randomUUID();
  try{
   const url=new URL(request.url);if(url.pathname==='/healthz')return secure(json({status:'ok',version:LUMI_CORE_VERSION,productionReady:false}),requestId);if(!url.pathname.startsWith('/api/'))return new Response('Not found',{status:404});if(!['GET','POST','PUT'].includes(request.method))throw new AppError(405,'METHOD_NOT_ALLOWED');if(request.method!=='GET'){const origin=request.headers.get('origin');if((origin&&origin!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site')throw new AppError(403,'CROSS_ORIGIN_DENIED')}
   const db=dbFor(env);
   if(url.pathname==='/api/setup/status'&&request.method==='GET')return secure(json({initialized:await installationInitialized(db),coreRelease:LUMI_CORE_VERSION}),requestId);
   const principal=await authenticate(request,env);
   if(url.pathname==='/api/setup'&&request.method==='POST'){
    const body=object(await readJson(request),['name','displayName']);const user=await initializeInstallation(db,{name:body.name,displayName:body.displayName,coreRelease:LUMI_CORE_VERSION,principal});return secure(json({initialized:true,user:{id:user.id,displayName:user.displayName,role:user.role}},201),requestId)
   }
   if(url.pathname==='/api/auth/session'&&request.method==='POST'){const session=await createInstallationSession(db,principal);const response=secure(json({user:session.user,expiresAt:session.expiresAt}),requestId);response.headers.set('Set-Cookie',session.cookie);return response}
   const actor=await readInstallationUser(db,principal);
   if(url.pathname==='/api/session'&&request.method==='GET'){const installation=await db.prepare('SELECT name,core_release AS coreRelease FROM installation WHERE singleton=1').first();return secure(json({demo,standalone:true,user:actor,installation}),requestId)}
   if(url.pathname==='/api/users'){
    requireInstallationRole(actor,'owner');if(request.method==='GET'){const rows=await db.prepare('SELECT id,issuer,subject,display_name AS displayName,role,state,created_at AS createdAt,updated_at AS updatedAt FROM users ORDER BY display_name,id LIMIT 200').all();return secure(json({users:rows.results}),requestId)}
    const body=object(await readJson(request),['issuer','subject','displayName','role']);const user=await upsertInstallationUser(db,body as {issuer:unknown;subject:unknown;displayName:unknown;role:unknown;state?:unknown});return secure(json({user},201),requestId)
   }
   const userState=/^\/api\/users\/([a-f0-9-]{20,80})$/.exec(url.pathname);if(userState&&request.method==='PUT'){requireInstallationRole(actor,'owner');const body=object(await readJson(request),['state']);const state=String(body.state);if(state!=='active'&&state!=='disabled')throw new AppError(422,'INVALID_USER_STATE');const userId=userState[1]!;if(!await db.prepare('SELECT id FROM users WHERE id=?').bind(userId).first())throw new AppError(404,'USER_NOT_FOUND');await db.prepare('UPDATE users SET state=?,updated_at=? WHERE id=?').bind(state,new Date().toISOString(),userId).run();if(state==='disabled')await revokeInstallationSessions(db,userId);return secure(json({id:userId,state}),requestId)}
   if(url.pathname==='/api/sources'){
    if(request.method==='GET'){const rows=await db.prepare('SELECT id,name,state FROM sources ORDER BY id LIMIT 200').all();return secure(json({sources:rows.results}),requestId)}requireInstallationRole(actor,'owner');const body=object(await readJson(request),['id','name']);const sourceId=id(body.id);const name=String(body.name);if(!name.trim()||name.length>160)throw new AppError(422,'INVALID_SOURCE');try{await db.prepare("INSERT INTO sources(id,name,state) VALUES (?,?, 'active')").bind(sourceId,name.trim()).run()}catch{throw new AppError(409,'SOURCE_EXISTS')}return secure(json({id:sourceId,name:name.trim(),state:'active'},201),requestId)
   }
   const sourceState=/^\/api\/sources\/([a-z0-9][a-z0-9_-]{0,63})$/.exec(url.pathname);if(sourceState&&request.method==='PUT'){requireInstallationRole(actor,'owner');const body=object(await readJson(request),['state']);const state=String(body.state);if(state!=='active'&&state!=='disabled')throw new AppError(422,'INVALID_SOURCE_STATE');const sourceId=sourceState[1]!;const result=await db.prepare('UPDATE sources SET state=? WHERE id=?').bind(state,sourceId).run();if((result.meta.changes??0)!==1)throw new AppError(404,'SOURCE_NOT_FOUND');return secure(json({id:sourceId,state}),requestId)}
   if(url.pathname==='/api/metrics'&&request.method==='GET')return secure(json({version:'operations-v1',metrics:metrics.map(({expression,...item})=>item)}),requestId);
   if(url.pathname==='/api/query'&&request.method==='POST')return secure(json((await executeInstallationQueries(db,principal,actor.role,[parseQuery(await readJson(request))])).results[0]),requestId);
   if(url.pathname==='/api/query-batch'&&request.method==='POST'){const body=object(await readJson(request),['queries']);if(!Array.isArray(body.queries)||body.queries.length<1||body.queries.length>12)throw new AppError(400,'QUERY_BATCH_LIMIT');return secure(json(await executeInstallationQueries(db,principal,actor.role,body.queries.map(parseQuery))),requestId)}
   if(url.pathname==='/api/imports'){
    if(request.method==='GET'){const rows=await db.prepare('SELECT id,source_id,content_hash,observed_through,ingested_at,record_count FROM snapshots ORDER BY ingested_at DESC LIMIT 50').all();return secure(json({imports:rows.results}),requestId)}requireInstallationRole(actor,'owner');return secure(json(await importInstallationSnapshot(env,db,principal,parseSnapshot(await readJson(request)),request.headers.get('idempotency-key')??''),201),requestId)
   }
   if(url.pathname==='/api/dashboards'){
    if(request.method==='GET')return secure(json({dashboards:await dashboardList(db)}),requestId);requireInstallationRole(actor,'editor');const body=object(await readJson(request),['id','definition']);const dashboardId=id(body.id);const definition=parseDashboard(body.definition);const now=new Date().toISOString();try{await db.batch([db.prepare('INSERT INTO dashboards(id,definition,revision,updated_at) VALUES (?,?,1,?)').bind(dashboardId,JSON.stringify(definition),now),db.prepare('INSERT INTO audit_events(id,actor,event_type,resource_id,occurred_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),principal.subject,'dashboard.created',dashboardId,now)])}catch{throw new AppError(409,'DASHBOARD_EXISTS')}return secure(json({id:dashboardId,definition,revision:1},201),requestId)
   }
   const dashboardState=/^\/api\/dashboards\/([a-z0-9][a-z0-9_-]{0,63})$/.exec(url.pathname);if(dashboardState&&request.method==='PUT'){requireInstallationRole(actor,'editor');const dashboardId=dashboardState[1]!;const definition=parseDashboard(await readJson(request));const etag=request.headers.get('if-match');if(!etag||!/^(?:"[1-9]\d{0,8}")$/.test(etag))throw new AppError(428,'REVISION_REQUIRED');const expected=Number(etag.slice(1,-1)),now=new Date().toISOString();const result=await db.batch([db.prepare('UPDATE dashboards SET definition=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(definition),now,dashboardId,expected),db.prepare("INSERT INTO audit_events(id,actor,event_type,resource_id,occurred_at) SELECT ?,?,?,?,? WHERE changes()>0").bind(crypto.randomUUID(),principal.subject,'dashboard.updated',dashboardId,now)]);if(result[0]?.meta.changes!==1)throw new AppError(409,'REVISION_CONFLICT');const response=secure(json({id:dashboardId,definition,revision:expected+1}),requestId);response.headers.set('ETag',`"${expected+1}"`);return response}
   const customMetric=/^\/api\/custom-metrics\/([a-z0-9_.-]{1,128})$/.exec(url.pathname);if(customMetric&&request.method==='GET'){const extension=options.customMetrics?.find(item=>item.id===customMetric[1]);if(!extension)throw new AppError(404,'CUSTOM_METRIC_NOT_FOUND');const result=await extension.execute({request,db,principal,role:actor.role,query:q=>executeInstallationQueries(db,principal,actor.role,[q])});return secure(json({id:extension.id,version:extension.version,...result,role:actor.role,coreVersion:LUMI_CORE_VERSION}),requestId)}
   if(url.pathname==='/api/custom-rules'&&request.method==='GET')return secure(json({version:'operations-v1',rules:options.decisionRules??[],role:actor.role,coreVersion:LUMI_CORE_VERSION}),requestId);
   throw new AppError(404,'NOT_FOUND');
  }catch(error){const appError=error instanceof AppError?error:new AppError(500,'INTERNAL_ERROR');return secure(json({error:{code:appError.code,requestId}},appError.status),requestId)}
 }
}
