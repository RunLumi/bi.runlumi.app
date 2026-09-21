import {AppError,object,id,parseSnapshot,type Principal,type Role,type Query} from './contracts.ts';
import {metrics,parseQuery,parseDashboard,type Dashboard} from './semantics.ts';
import {executeInstallationQueries} from './query.ts';
import {importInstallationSnapshot} from './ingest.ts';
import {installationInitialized,initializeInstallation,loginInstallation,logoutInstallation,parseSessionCookie,readInstallationUser,requireInstallationRole,upsertInstallationUser,setInstallationCredential,changeOwnPassword,setInstallationUserState,setInstallationUserRole,authenticateInstallationSession,createInstallationSession,type InstallationUser} from './installation-auth.ts';
import {LUMI_CORE_VERSION} from './version.ts';
import type {AppEnv,Database} from './ports.ts';
import type {CoreModule,DecisionRule} from './extension-contracts.ts';
import {createCommerceConnection,changeCommerceConnection,readCommerceConnections} from './commerce-connections.ts';
import {acceptCommerceExport,readCommerceReceipts} from './commerce-receipts.ts';
import {normalizeCommerceReceipt,readCommerceNormalizations,readCommerceStaging} from './commerce-normalization.ts';
import {registerCommerceMapping,previewCommercePublication,publishCommerce,readCommercePublication,readCommercePublicationStatus,readCommerceQueryPublication} from './commerce-publication.ts';
import {enqueueCommerceJob,executeCommerceJob,readCommerceJobs,readCommerceJob} from './commerce-jobs.ts';
import {commerceMetrics,parseCommerceQuery,queryCommerceReport} from './commerce-query.ts';
import {answerCommerceQuestion} from './commerce-analyst.ts';
import {readCommerceInsightFindings,createCommerceDecision,updateCommerceDecision,readCommerceDecisions,exportCommerceReport} from './commerce-decisions.ts';
import {createCommerceInsight,readCommerceInsightsArtifacts,refreshCommerceInsight,promoteCommerceInsight} from './commerce-insight-artifacts.ts';
import {readCommerceCapabilities,reviewCommerceCapability} from './commerce-capabilities.ts';
import type {ObjectStore} from './ports.ts';

export type Authenticate<E extends AppEnv=AppEnv>=(request:Request,env:E)=>Promise<Principal|InstallationUser>;
export interface CustomMetricResult {value:string|null;unit:string;evidence:unknown}
export interface InstallationMetricContext {request:Request;db:Database;principal:Principal;role:Role;query:(query:Query)=>ReturnType<typeof executeInstallationQueries>}
export interface CustomMetricExtension {id:string;version:number;execute:(context:InstallationMetricContext)=>Promise<CustomMetricResult>}
export type ConnectorResourceType='orders'|'settlements'|'inventory'|'workflow_facts';
export interface ConnectorPullRequest {connectionId:string;resourceType:ConnectorResourceType;window:{from:string;toExclusive:string};observedAt:string}
export interface ConnectorAdapter {provider:string;resources:readonly ConnectorResourceType[];transport:'authorized-export';pull(request:ConnectorPullRequest):Promise<unknown>}
export interface ApiOptions {customMetrics?:readonly CustomMetricExtension[];connectors?:readonly ConnectorAdapter[];decisionRules?:readonly DecisionRule[];modules?:readonly CoreModule[];standalone?:boolean}
const MAX_BODY=131_072;
const SETUPS=[['setupToken','SETUP_TOKEN']] as const;
async function readJson(request:Request):Promise<unknown>{
 if(request.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()!=='application/json')throw new AppError(415,'JSON_REQUIRED');
 const declared=request.headers.get('content-length');if(declared!==null&&(!/^\d+$/.test(declared)||Number(declared)>MAX_BODY))throw new AppError(413,'BODY_TOO_LARGE');if(!request.body)throw new AppError(400,'BODY_REQUIRED');
 const reader=request.body.getReader();const chunks:Uint8Array[]=[];let size=0;while(true){const {value,done}=await reader.read();if(done)break;size+=value.byteLength;if(size>MAX_BODY){await reader.cancel();throw new AppError(413,'BODY_TOO_LARGE')}chunks.push(value)}const all=new Uint8Array(size);let offset=0;for(const chunk of chunks){all.set(chunk,offset);offset+=chunk.length}try{return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(all))}catch{throw new AppError(400,'INVALID_JSON')}
}
function json(value:unknown,status=200):Response{return new Response(JSON.stringify(value),{status,headers:{'Content-Type':'application/json; charset=utf-8'}})}
function secure(response:Response,requestId:string):Response{const out=new Response(response.body,response);out.headers.set('Cache-Control','private, no-store');out.headers.set('X-Content-Type','nosniff');out.headers.set('X-Request-ID',requestId);return out}
function dbFor<E extends AppEnv>(env:E):Database{const db=(env.DB??env.SERVING) as Database|undefined;if(!db||typeof db.prepare!=='function')throw new AppError(503,'INSTALLATION_DATABASE_UNAVAILABLE');return db}
function storeFor<E extends AppEnv>(env:E):ObjectStore{const store=env.SOURCES as ObjectStore|undefined;if(!store||typeof store.put!=='function')throw new AppError(503,'INSTALLATION_STORAGE_UNAVAILABLE');return store}
function validateOptions(options:ApiOptions):void{for(const connector of options.connectors??[]){if(!/^[a-z][a-z0-9-]{0,62}$/.test(connector.provider)||connector.transport!=='authorized-export'||!connector.resources.length||typeof connector.pull!=='function')throw new AppError(500,'INVALID_CONNECTOR_CONFIG')}}
async function dashboardList(db:Database):Promise<unknown[]>{const rows=await db.prepare('SELECT id,definition,revision,updated_at AS updatedAt FROM dashboards ORDER BY id LIMIT 50').all();return rows.results.map(row=>({...row,definition:parseDashboard(JSON.parse(String(row.definition))),management:'ui'}))}
function timingSafeEqual(a:string,b:string):boolean{if(a.length!==b.length)return false;let diff=0;for(let i=0;i<a.length;i++)diff|=a.charCodeAt(i)^b.charCodeAt(i);return diff===0;}
/** First-run setup protection: when a SETUP_TOKEN secret is configured it must
 * be presented; initialization itself is closed permanently by the singleton
 * installation row, so replay or takeover after success is impossible. */
async function assertSetupAllowed<E extends AppEnv>(env:E,body:Record<string,unknown>):Promise<void>{
 for(const [field,binding] of SETUPS){const expected=env[binding];if(typeof expected==='string'&&expected.length){if(typeof body[field]!=='string'||!timingSafeEqual(String(body[field]),expected))throw new AppError(403,'SETUP_TOKEN_REQUIRED');delete body[field];}}
}
const principalOf=(identity:InstallationUser):Principal=>({issuer:identity.issuer,subject:identity.subject});

export function createApi<E extends AppEnv=AppEnv>(authenticate:Authenticate<E>,demo=false,options:ApiOptions={}):((request:Request,env:E)=>Promise<Response>){
 validateOptions(options);
 return async(request:Request,env:E):Promise<Response>=>{
  const requestId=crypto.randomUUID();
  try{
   const url=new URL(request.url);if(url.pathname==='/healthz')return secure(json({status:'ok',version:LUMI_CORE_VERSION,productionReady:false}),requestId);if(!url.pathname.startsWith('/api/'))return new Response('Not found',{status:404});if(!['GET','POST','PUT'].includes(request.method))throw new AppError(405,'METHOD_NOT_ALLOWED');if(request.method!=='GET'){const origin=request.headers.get('origin');if((origin&&origin!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site')throw new AppError(403,'CROSS_ORIGIN_DENIED')}
   const db=dbFor(env),store=storeFor(env);
   const initialized=await installationInitialized(db);
   if(url.pathname==='/api/setup/status'&&request.method==='GET')return secure(json({initialized,coreRelease:LUMI_CORE_VERSION}),requestId);
   if(url.pathname==='/api/auth/login'&&request.method==='POST'){const body=object(await readJson(request),['login','password']);const session=await loginInstallation(db,{login:body.login,password:body.password});const response=secure(json({user:session.user,expiresAt:session.expiresAt}),requestId);response.headers.set('Set-Cookie',session.cookie);return response}
   if(url.pathname==='/api/setup'&&request.method==='POST'){
    if(initialized)throw new AppError(409,'INSTALLATION_ALREADY_INITIALIZED');
    const body=object(await readJson(request),['name','displayName','login','password','setupToken']);
    await assertSetupAllowed(env,body);
    const user=await initializeInstallation(db,{name:body.name,displayName:body.displayName,login:body.login,password:body.password,coreRelease:LUMI_CORE_VERSION});
    const session=await createInstallationSession(db,{issuer:user.issuer,subject:user.subject},user);
    const response=secure(json({initialized:true,user:{id:user.id,displayName:user.displayName,role:user.role,login:user.subject}},201),requestId);
    response.headers.set('Set-Cookie',session.cookie);return response;
   }
   if(!initialized)throw new AppError(409,'INSTALLATION_NOT_INITIALIZED');
   const actor=await (async()=>{
    const cookieToken=parseSessionCookie(request.headers.get('cookie'));
    if(cookieToken)return await authenticateInstallationSession(db,cookieToken);
    const external=await authenticate(request,env);
    return 'state' in external?external:await readInstallationUser(db,external);
   })();
   if(url.pathname==='/api/auth/logout'&&request.method==='POST'){const token=parseSessionCookie(request.headers.get('cookie'));if(token)await logoutInstallation(db,token);const response=secure(json({signedOut:true}),requestId);response.headers.set('Set-Cookie','lumi_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0');return response}
   if(url.pathname==='/api/auth/password'&&request.method==='POST'){const body=object(await readJson(request),['currentPassword','newPassword']);await changeOwnPassword(db,actor,{currentPassword:body.currentPassword,newPassword:body.newPassword});return secure(json({changed:true}),requestId)}
   if(url.pathname==='/api/auth/session'&&request.method==='POST'){const principal=principalOf(actor);if(!principal.subject)throw new AppError(403,'USER_NOT_FOUND');const session=await createInstallationSession(db,principal,actor);const response=secure(json({user:session.user,expiresAt:session.expiresAt}),requestId);response.headers.set('Set-Cookie',session.cookie);return response}
   if(url.pathname==='/api/session'&&request.method==='GET'){const installation=await db.prepare('SELECT name,core_release AS coreRelease FROM installation WHERE singleton=1').first();return secure(json({demo,standalone:true,user:actor,installation}),requestId)}
   if(url.pathname==='/api/users'){
    requireInstallationRole(actor,'owner');if(request.method==='GET'){const rows=await db.prepare('SELECT id,issuer,subject,display_name AS displayName,role,state,created_at AS createdAt,updated_at AS updatedAt FROM users ORDER BY display_name,id LIMIT 200').all();return secure(json({users:rows.results}),requestId)}
    const body=await readJson(request) as Record<string,unknown>;
    let resolved=body;
    if(body.login!==undefined){resolved={...body,issuer:'local',subject:body.login};delete resolved.login;}
    const normalized=object(resolved,['issuer','subject','displayName','role','state','password']);
    if(normalized.issuer==='local'&&normalized.password===undefined)throw new AppError(422,'PASSWORD_REQUIRED');
    const user=await upsertInstallationUser(db,normalized as {issuer:unknown;subject:unknown;displayName:unknown;role:unknown;state?:unknown;password?:unknown});return secure(json({user},201),requestId)
   }
   const userMutation=/^\/api\/users\/([a-f0-9-]{20,80})$/.exec(url.pathname);
   if(userMutation&&request.method==='PUT'){
    requireInstallationRole(actor,'owner');const userId=userMutation[1]!;const body=object(await readJson(request),['state','role','password']);
    if(body.state!==undefined){const state=String(body.state);if(state!=='active'&&state!=='disabled')throw new AppError(422,'INVALID_USER_STATE');if(!await db.prepare('SELECT id FROM users WHERE id=?').bind(userId).first())throw new AppError(404,'USER_NOT_FOUND');await setInstallationUserState(db,userId,state);return secure(json({id:userId,state}),requestId)}
    if(body.role!==undefined){const user=await setInstallationUserRole(db,userId,String(body.role) as Role);return secure(json({id:userId,role:user.role}),requestId)}
    if(body.password!==undefined){await setInstallationCredential(db,userId,body.password);return secure(json({id:userId,passwordReset:true}),requestId)}
    throw new AppError(400,'UNKNOWN_FIELD');
   }
   if(url.pathname==='/api/sources'){
    if(request.method==='GET'){const rows=await db.prepare('SELECT id,name,state FROM sources ORDER BY id LIMIT 200').all();return secure(json({sources:rows.results}),requestId)}requireInstallationRole(actor,'owner');const body=object(await readJson(request),['id','name']);const sourceId=id(body.id);const name=String(body.name);if(!name.trim()||name.length>160)throw new AppError(422,'INVALID_SOURCE');try{await db.prepare("INSERT INTO sources(id,name,state) VALUES (?,?, 'active')").bind(sourceId,name.trim()).run()}catch{throw new AppError(409,'SOURCE_EXISTS')}return secure(json({id:sourceId,name:name.trim(),state:'active'},201),requestId)
   }
   const sourceState=/^\/api\/sources\/([a-z0-9][a-z0-9_-]{0,63})$/.exec(url.pathname);if(sourceState&&request.method==='PUT'){requireInstallationRole(actor,'owner');const body=object(await readJson(request),['state']);const state=String(body.state);if(state!=='active'&&state!=='disabled')throw new AppError(422,'INVALID_SOURCE_STATE');const sourceId=sourceState[1]!;const result=await db.prepare('UPDATE sources SET state=? WHERE id=?').bind(state,sourceId).run();if((result.meta.changes??0)!==1)throw new AppError(404,'SOURCE_NOT_FOUND');return secure(json({id:sourceId,state}),requestId)}
   if(url.pathname==='/api/metrics'&&request.method==='GET')return secure(json({version:'operations-v1',metrics:metrics.map(({expression,...item})=>item)}),requestId);
   if(url.pathname==='/api/query'&&request.method==='POST')return secure(json((await executeInstallationQueries(db,principalOf(actor),actor.role,[parseQuery(await readJson(request))])).results[0]),requestId);
   if(url.pathname==='/api/query-batch'&&request.method==='POST'){const body=object(await readJson(request),['queries']);if(!Array.isArray(body.queries)||body.queries.length<1||body.queries.length>12)throw new AppError(400,'QUERY_BATCH_LIMIT');return secure(json(await executeInstallationQueries(db,principalOf(actor),actor.role,body.queries.map(parseQuery))),requestId)}
   if(url.pathname==='/api/imports'){
    if(request.method==='GET'){const rows=await db.prepare('SELECT id,source_id,content_hash,observed_through,ingested_at,record_count FROM snapshots ORDER BY ingested_at DESC LIMIT 50').all();return secure(json({imports:rows.results}),requestId)}requireInstallationRole(actor,'owner');return secure(json(await importInstallationSnapshot(env,db,principalOf(actor),parseSnapshot(await readJson(request)),request.headers.get('idempotency-key')??''),201),requestId)
   }
   if(url.pathname==='/api/dashboards'){
    if(request.method==='GET')return secure(json({dashboards:await dashboardList(db)}),requestId);requireInstallationRole(actor,'editor');const body=object(await readJson(request),['id','definition']);const dashboardId=id(body.id);const definition=parseDashboard(body.definition);const now=new Date().toISOString();try{await db.batch([db.prepare('INSERT INTO dashboards(id,definition,revision,updated_at) VALUES (?,?,1,?)').bind(dashboardId,JSON.stringify(definition),now),db.prepare('INSERT INTO audit_events(id,actor,event_type,resource_id,occurred_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),actor.id,'dashboard.created',dashboardId,now)])}catch{throw new AppError(409,'DASHBOARD_EXISTS')}return secure(json({id:dashboardId,definition,revision:1},201),requestId)
   }
   const dashboardState=/^\/api\/dashboards\/([a-z0-9][a-z0-9_-]{0,63})$/.exec(url.pathname);if(dashboardState&&request.method==='PUT'){requireInstallationRole(actor,'editor');const dashboardId=dashboardState[1]!;const definition=parseDashboard(await readJson(request));const etag=request.headers.get('if-match');if(!etag||!/^(?:"[1-9]\d{0,8}")$/.test(etag))throw new AppError(428,'REVISION_REQUIRED');const expected=Number(etag.slice(1,-1)),now=new Date().toISOString();const result=await db.batch([db.prepare('UPDATE dashboards SET definition=?,revision=revision+1,updated_at=? WHERE id=? AND revision=?').bind(JSON.stringify(definition),now,dashboardId,expected),db.prepare("INSERT INTO audit_events(id,actor,event_type,resource_id,occurred_at) SELECT ?,?,?,?,? WHERE changes()>0").bind(crypto.randomUUID(),actor.id,'dashboard.updated',dashboardId,now)]);if(result[0]?.meta.changes!==1)throw new AppError(409,'REVISION_CONFLICT');const response=secure(json({id:dashboardId,definition,revision:expected+1}),requestId);response.headers.set('ETag',`"${expected+1}"`);return response}
   if(url.pathname.startsWith('/api/commerce/'))return await commerceApi(request,{db,store,actor,requestId,options});
   const customMetric=/^\/api\/custom-metrics\/([a-z0-9_.-]{1,128})$/.exec(url.pathname);if(customMetric&&request.method==='GET'){const extension=options.customMetrics?.find(item=>item.id===customMetric[1]);if(!extension)throw new AppError(404,'CUSTOM_METRIC_NOT_FOUND');const result=await extension.execute({request,db,principal:principalOf(actor),role:actor.role,query:q=>executeInstallationQueries(db,principalOf(actor),actor.role,[q])});return secure(json({id:extension.id,version:extension.version,...result,role:actor.role,coreVersion:LUMI_CORE_VERSION}),requestId)}
   if(url.pathname==='/api/custom-rules'&&request.method==='GET')return secure(json({version:'operations-v1',rules:options.decisionRules??[],role:actor.role,coreVersion:LUMI_CORE_VERSION}),requestId);
   throw new AppError(404,'NOT_FOUND');
  }catch(error){const appError=error instanceof AppError?error:new AppError(500,'INTERNAL_ERROR');return secure(json({error:{code:appError.code,requestId}},appError.status),requestId)}
 }
}
interface CommerceArgs<E extends AppEnv>{db:Database;store:ObjectStore;actor:InstallationUser;requestId:string;options:ApiOptions}
async function commerceApi<E extends AppEnv>(request:Request,args:CommerceArgs<E>):Promise<Response>{
 const {db,store,actor}=args,requestId=args.requestId,url=new URL(request.url),path=url.pathname.slice('/api/commerce'.length),respond=(value:unknown,status=200)=>secure(json(value,status),requestId);
 const postBody=async()=>await readJson(request) as Record<string,unknown>;
 if(path==='/connections'){
  if(request.method==='GET')return respond(await readCommerceConnections(db,actor));
  requireInstallationRole(actor,'owner');return respond(await createCommerceConnection(db,actor,await postBody()),201);
 }
 const connection=/^\/connections\/([a-z0-9][a-z0-9_-]{0,63})$/.exec(path);
 if(connection&&request.method==='PUT'){requireInstallationRole(actor,'owner');const body=await postBody();const expected=Number(body.expectedRevision);if(!Number.isSafeInteger(expected)||expected<1)throw new AppError(428,'CONNECTION_REVISION_REQUIRED');delete body.expectedRevision;return respond(await changeCommerceConnection(db,actor,connection[1]!,body,expected));}
 if(path==='/receipts'){
  if(request.method==='GET')return respond(await readCommerceReceipts(db,actor,new URL(request.url).searchParams.get('receiptId')??undefined));
  requireInstallationRole(actor,'owner');const result=await acceptCommerceExport(db,store,actor,await postBody());return respond(result,result.replayed?200:202);
 }
 if(path==='/normalizations'){
  if(request.method==='GET')return respond(await readCommerceNormalizations(db,actor,new URL(request.url).searchParams.get('normalizationId')??undefined));
  requireInstallationRole(actor,'owner');const result=await normalizeCommerceReceipt(db,store,actor,await postBody());return respond(result,result.replayed?200:201);
 }
 const staging=/^\/staging\/([a-z0-9][a-z0-9_-]{0,63})$/.exec(path);
 if(staging&&request.method==='GET')return respond(await readCommerceStaging(db,actor,staging[1]!));
 if(path==='/mappings'&&request.method==='POST'){requireInstallationRole(actor,'owner');return respond(await registerCommerceMapping(db,actor,await postBody()),201);}
 if(path==='/publications/preview'&&request.method==='POST'){requireInstallationRole(actor,'owner');return respond(await previewCommercePublication(db,actor,await postBody()));}
 if(path==='/publications'){
  if(request.method==='GET')return respond(await readCommercePublication(db,actor,new URL(request.url).searchParams.get('publicationId')??undefined));
  requireInstallationRole(actor,'owner');const result=await publishCommerce(db,actor,await postBody());return respond(result,result.replayed?200:201);
 }
 if(path==='/publication-status'&&request.method==='GET')return respond(await readCommercePublicationStatus(db,actor));
 const exportMatch=/^\/publications\/([a-z0-9][a-z0-9_-]{0,63})\/export$/.exec(path);
 if(exportMatch&&request.method==='GET')return secure(await exportCommerceReport(db,actor,exportMatch[1]!,new URL(request.url).searchParams.get('format')??'csv'),requestId);
 if(path==='/jobs'){
  if(request.method==='GET')return respond(await readCommerceJobs(db,actor));
  requireInstallationRole(actor,'owner');return respond(await enqueueCommerceJob(db,actor,await postBody()),202);
 }
 const jobRun=/^\/jobs\/([a-z0-9][a-z0-9_-]{0,63})\/run$/.exec(path);
 if(jobRun&&request.method==='POST'){requireInstallationRole(actor,'owner');return respond(await executeCommerceJob(db,actor,jobRun[1]!,store));}
 const job=/^\/jobs\/([a-z0-9][a-z0-9_-]{0,63})$/.exec(path);
 if(job&&request.method==='GET')return respond(await readCommerceJob(db,actor,job[1]!));
 if(path==='/metrics'&&request.method==='GET')return respond({version:'commerce-v1',metrics:commerceMetrics});
 if(path==='/queries'&&request.method==='POST')return respond(await answerCommerceQuery(db,actor,await postBody()));
 if(path==='/findings'&&request.method==='GET')return respond(await readCommerceInsightFindings(db,actor));
 if(path==='/decisions'){
  if(request.method==='GET')return respond(await readCommerceDecisions(db,actor,new URL(request.url).searchParams.get('decisionId')??undefined));
  requireInstallationRole(actor,'owner');return respond(await createCommerceDecision(db,actor,await postBody()),201);
 }
 const decision=/^\/decisions\/([a-z0-9][a-z0-9_-]{0,63})$/.exec(path);
 if(decision&&request.method==='PUT'){requireInstallationRole(actor,'owner');const body=await postBody();const expected=Number(body.expectedRevision);if(!Number.isSafeInteger(expected)||expected<1)throw new AppError(428,'REVISION_REQUIRED');delete body.expectedRevision;return respond(await updateCommerceDecision(db,actor,decision[1]!,body,expected));}
 if(path==='/insights'){
  if(request.method==='GET')return respond(await readCommerceInsightsArtifacts(db,actor,new URL(request.url).searchParams.get('insightId')??undefined));
  requireInstallationRole(actor,'owner');return respond(await createCommerceInsight(db,actor,await postBody()),201);
 }
 const insightMutation=/^\/insights\/([a-z0-9][a-z0-9_-]{0,63})\/(refresh|promote)$/.exec(path);
 if(insightMutation&&request.method==='POST'){requireInstallationRole(actor,'owner');if(insightMutation[2]==='promote')return respond(await promoteCommerceInsight(db,actor,insightMutation[1]!));return respond(await refreshCommerceInsight(db,actor,insightMutation[1]!,await postBody()));}
 if(path==='/capabilities'){
  if(request.method==='GET')return respond(await readCommerceCapabilities(db,actor));
  requireInstallationRole(actor,'owner');return respond(await reviewCommerceCapability(db,actor,await postBody()),201);
 }
 if(path==='/ask'&&request.method==='POST')return respond(await answerCommerceQuestion(db,actor,await postBody()));
 throw new AppError(404,'NOT_FOUND');
}
/** Published-only, role-scoped commerce metric query over the active publication. */
async function answerCommerceQuery(db:Database,actor:InstallationUser,body:Record<string,unknown>){
 const query=parseCommerceQuery(body);
 const publication=await readCommerceQueryPublication(db,query.dataVersion);
 return {publicationId:publication.id,contentHash:publication.contentHash,consistency:'published',result:queryCommerceReport(publication.report as unknown as Record<string,unknown>,query),warnings:publication.report.warnings,semanticVersion:publication.report.semanticVersion};
}
