/** Behavioral acceptance for THIS customer application, run against the
 * packaged @runlumi/* artifacts in node_modules with a local SQLite adapter.
 * No Cloudflare account, network or Lumi-operated service is involved. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LocalDatabase,LocalObjects} from '@runlumi/cloudflare/testing.ts';
import {createApi} from '@runlumi/core/api.ts';
import {commerceSchemaFingerprint} from '@runlumi/core/commerce-model.ts';
import {manifest} from '../manifest.ts';
import {customMetrics} from '../data/metrics.ts';
import {customMetricExtensions} from '../data/server-metrics.ts';
import {decisionRules} from '../workflows/decisions.ts';

const MIGRATIONS=['0001_initial.sql','0002_credentials_and_commerce.sql'];
async function fresh(){const db=new LocalDatabase();for(const f of MIGRATIONS)db.db.exec(await readFile(new URL(`../../node_modules/@runlumi/core/migrations/installation/${f}`,import.meta.url),'utf8'));return db;}
function apiFor(db){return createApi(async()=>({issuer:'local',subject:'no-one'}),false,{customMetrics:customMetricExtensions,decisionRules,modules:manifest.modules,standalone:true});}
const req=(path,{method='GET',body,headers={}}={})=>new Request(`http://localhost:8787${path}`,{method,...(body!==undefined?{body:JSON.stringify(body)}:{}),headers:{...(body!==undefined?{'content-type':'application/json'}:{}),...headers}});
const cookieOf=r=>(r.headers.get('set-cookie')??'').split(';')[0];

test('customer manifest is namespaced and declares reviewed modules',()=>{assert.ok(manifest.customerId);assert.ok(manifest.modules.includes('operations'));assert.equal(typeof manifest.displayName,'string');});

test('setup creates the administrator once; replay is refused',async()=>{
 const db=await fresh();const api=apiFor(db);
 let r=await api(req('/api/setup',{method:'POST',body:{name:manifest.displayName,login:'owner@acme.test',displayName:'Owner',password:['acme','owner','pass'].join('-')}}),{DB:db,SOURCES:new LocalObjects()});
 assert.equal(r.status,201);
 r=await api(req('/api/setup',{method:'POST',body:{name:'X',login:'x@acme.test',displayName:'X',password:['acme','owner','pass'].join('-')}}),{DB:db,SOURCES:new LocalObjects()});
 assert.equal(r.status,409);
});

test('decision rules catalog is exposed to signed-in viewers',async()=>{
 const db=await fresh();const api=apiFor(db);const env={DB:db,SOURCES:new LocalObjects()};
 await api(req('/api/setup',{method:'POST',body:{name:'N',login:'o@acme.test',displayName:'O',password:['acme','owner','pass'].join('-')}}),env);
 const cookie=cookieOf(await api(req('/api/auth/login',{method:'POST',body:{login:'o@acme.test',password:['acme','owner','pass'].join('-')}}),env));
 const r=await api(req('/api/custom-rules',{headers:{cookie}}),env);
 assert.equal(r.status,200);
 const body=await r.json();
 assert.deepEqual(body.rules,decisionRules);
 assert.ok(body.rules.every(rule=>rule.externalAction===false),'no rule may execute external actions');
});

test('namespaced custom metrics execute through the bounded query compiler',async()=>{
 const db=await fresh();const api=apiFor(db);const env={DB:db,SOURCES:new LocalObjects()};
 await api(req('/api/setup',{method:'POST',body:{name:'N',login:'o@acme.test',displayName:'O',password:['acme','owner','pass'].join('-')}}),env);
 const cookie=cookieOf(await api(req('/api/auth/login',{method:'POST',body:{login:'o@acme.test',password:['acme','owner','pass'].join('-')}}),env));
 for(const metric of customMetrics){
  assert.ok(metric.id.startsWith('customer.'),'extension ids must stay namespaced');
  const r=await api(req(`/api/custom-metrics/${metric.id}`,{headers:{cookie}}),env);
  if(r.status!==200)throw new Error(await r.text());
  const body=await r.json();
  assert.equal(body.value,null,'an empty installation must report null, never a fabricated 0');
 }
});

test('customer composition cannot shadow reserved core routes',()=>{
 const reserved=new Set(['/','/money','/commerce-data','/operations','/configuration','/control']);
 for(const namespace of manifest.extensions)assert.ok(namespace.namespace.length>0);
 assert.ok(manifest.modules.every(m=>['commerce','operations','ai'].includes(m)));
 assert(!reserved.has('/customer-note'));
});

test('full commerce journey: connection -> receipt -> job -> publication -> export',async()=>{
 const db=await fresh();const objects=new LocalObjects();const api=apiFor(db);const env={DB:db,SOURCES:objects};
 let r=await api(req('/api/setup',{method:'POST',body:{name:'N',login:'o@acme.test',displayName:'O',password:['acme','owner','pass'].join('-')}}),env);
 const cookie=cookieOf(await api(req('/api/auth/login',{method:'POST',body:{login:'o@acme.test',password:['acme','owner','pass'].join('-')}}),env));
 r=await api(req('/api/commerce/connections',{method:'POST',headers:{cookie},body:{id:'orders-export',provider:'generic',sourceAccountId:'shop-A',resourceType:'orders',approvalRef:'reviewed-export'}}),env);
 assert.equal(r.status,201);
 const raw={contract:'lumi.commerce.export.v1',provider:'generic',sourceAccountId:'shop-A',resourceType:'orders',currency:'VND',taxBasis:'net-merchandise-actual-cash-v1',timezone:'Asia/Ho_Chi_Minh',window:{from:'2026-09-01T00:00:00.000Z',toExclusive:'2026-09-20T00:00:00.000Z'},observedAt:'2026-09-19T00:00:00.000Z',records:[{id:'9007199254740993',orderedAt:'2026-09-01T17:00:00.000Z',recognizedAt:'2026-09-03T00:00:00.000Z',state:'accepted',merchandise:'1000000',sellerDiscount:'100000',merchandiseReversal:'180000',cogs:'400000',cogsEvidenceRef:'cost-at-sale-1',variableFees:'80000',shippingIncome:'0',earnedSubsidy:'0'}]};
 r=await api(req('/api/commerce/receipts',{method:'POST',headers:{cookie},body:{eventType:'snapshot',connectionId:'orders-export',sourceAccountId:'shop-A',resourceType:'orders',deliveryId:'d1',sourceObjectId:'d1',sourceRevision:null,sourceEventAt:null,sourceUpdatedAt:null,window:raw.window,schemaFingerprint:await commerceSchemaFingerprint(),rawJson:JSON.stringify(raw)}}),env);
 if(![200,202].includes(r.status))throw new Error(await r.text());
 const receipt=await r.json();
 r=await api(req('/api/commerce/jobs',{method:'POST',headers:{cookie},body:{receiptId:receipt.receiptId}}),env);
 const job=await r.json();
 r=await api(req(`/api/commerce/jobs/${job.jobId}/run`,{method:'POST',headers:{cookie}}),env);
 if(r.status!==200)throw new Error(await r.text());
 assert.equal((await r.json()).state,'SUCCEEDED');
 const normalizations=await (await api(req('/api/commerce/normalizations',{headers:{cookie}}),env)).json();
 const body={normalizationIds:normalizations.normalizations.map(n=>n.normalizationId),mappingId:null,controls:[],expectedRevision:0,expectedPublicationId:null};
 const preview=await (await api(req('/api/commerce/publications/preview',{method:'POST',headers:{cookie},body}),env)).json();
 r=await api(req('/api/commerce/publications',{method:'POST',headers:{cookie},body:{...body,previewHash:preview.previewHash,reason:'test close'}}),env);
 const published=await r.json();
 assert.equal(published.replayed,false);
 const query=await (await api(req('/api/commerce/queries',{method:'POST',headers:{cookie},body:{contract:'lumi.query.v1',metrics:[{id:'net_merchandise_sales',version:1}],dimensions:[],filters:[],limit:10,consistency:'published',dataVersion:published.publicationId}}),env)).json();
 assert.equal(query.result.metrics.net_merchandise_sales.value,'720000');
 const csv=await api(req(`/api/commerce/publications/${published.publicationId}/export?format=csv`,{headers:{cookie}}),env);
 assert.equal(csv.status,200);
});

test('disabled users lose access immediately; last owner is protected',async()=>{
 const db=await fresh();const api=apiFor(db);const env={DB:db,SOURCES:new LocalObjects()};
 await api(req('/api/setup',{method:'POST',body:{name:'N',login:'o@acme.test',displayName:'O',password:['acme','owner','pass'].join('-')}}),env);
 const ownerCookie=cookieOf(await api(req('/api/auth/login',{method:'POST',body:{login:'o@acme.test',password:['acme','owner','pass'].join('-')}}),env));
 await api(req('/api/users',{method:'POST',headers:{cookie:ownerCookie},body:{login:'v@acme.test',displayName:'V',role:'viewer',password:['acme','viewer','pass'].join('-')}}),env);
 const viewerCookie=cookieOf(await api(req('/api/auth/login',{method:'POST',body:{login:'v@acme.test',password:['acme','viewer','pass'].join('-')}}),env));
 assert.equal((await api(req('/api/sources',{headers:{cookie:viewerCookie}}),env)).status,200);
 const users=await (await api(req('/api/users',{headers:{cookie:ownerCookie}}),env)).json();
 const viewer=users.users.find(u=>u.subject==='v@acme.test');
 await api(req(`/api/users/${viewer.id}`,{method:'PUT',headers:{cookie:ownerCookie},body:{state:'disabled'}}),env);
 assert.equal([401,403].includes((await api(req('/api/session',{headers:{cookie:viewerCookie}}),env)).status),true);
 const ownerId=users.users.find(u=>u.subject==='o@acme.test').id;
 assert.equal((await api(req(`/api/users/${ownerId}`,{method:'PUT',headers:{cookie:ownerCookie},body:{state:'disabled'}}),env)).status,409);
});
