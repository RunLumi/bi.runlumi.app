import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,request} from '../scripts/local-adapters.mjs';
import {parseTenantPack} from '@runlumi/core/tenant-pack.ts';
import {compilePack} from '../scripts/tenant-pack.mjs';

const plan={metrics:['cases','cash_savings_vnd'],groupBy:'none',from:'2026-09-01',to:'2026-10-01'};
const batch=(f,body={},user='alpha-owner')=>f.api(request('/api/tenants/alpha/query-batch',{user,method:'POST',body:{configurationRelease:'builtin',configurationRevision:0,queries:[plan,{...plan,groupBy:'workflow'}],...body}}),f.env);
const control=(f,path,body,revision)=>f.api(request('/api/control/tenants/alpha/'+path,{user:'platform-admin',method:'POST',body,headers:revision===undefined?{}:{'if-match':`"${revision}"`}}),f.env);
async function bundle(f){const p=await compilePack(new URL('../examples/tenant-pack/',import.meta.url));p.dashboards=[{id:'git-ops',definition:f.dashboard}];return p;}
async function register(f,p,commit='c'.repeat(40)){
 f.env.CONTROL_DB.db.prepare('INSERT OR IGNORE INTO pack_sources VALUES (?,?,?)').run('alpha','RunLumi/configs','tenants/alpha');
 return control(f,'releases',{repository:'RunLumi/configs',sourcePath:'tenants/alpha',sourceCommit:commit,pack:p});
}
const activate=(f,releaseId,rev=0,epoch=1)=>control(f,'activation',{releaseId,routeEpoch:epoch,reason:'Reviewed fixture'},rev);

test('C10-A03 batch pins one route, release and snapshot vector for every widget',async()=>{const f=await fixture();try{
 let batches=0;const original=f.env.TENANT_A.batch.bind(f.env.TENANT_A);f.env.TENANT_A.batch=(s)=>{batches++;return original(s);};
 const response=await batch(f);assert.equal(response.status,200);const b=await response.json();assert.equal(batches,1);assert.equal(b.results.length,2);
 assert(b.results.every(r=>r.meta.contextHash===b.contextHash&&r.meta.routeEpoch===1&&r.meta.configurationRelease==='builtin'));
 assert.equal(b.results[0].data[0].cases,450);assert.equal(b.results[1].data.reduce((n,r)=>n+r.cases,0),450);
 assert.equal(b.results[0].data[0].cash_savings_vnd,0);assert.equal(b.results[0].meta.sourceCompletenessCertified,false);
}finally{f.close();}});

test('C10-A03 incompatible UI or Git configuration pin fails the whole batch',async()=>{const f=await fixture();try{
 for(const pin of [{configurationRelease:'foreign-release'},{configurationRevision:9}]){let calls=0;f.env.TENANT_A.batch=async()=>{calls++;throw new Error('must not execute');};const response=await batch(f,pin);assert.equal(response.status,409);assert.equal(calls,0);}
}finally{f.close();}});

test('C01-A01 batch and readiness deny cross-tenant and implicit operator access',async()=>{const f=await fixture();try{
 for(const user of ['beta-owner','platform-admin']){const before=f.env.TENANT_A.calls;assert.equal((await batch(f,{},user)).status,403);assert.equal((await f.api(request('/api/tenants/alpha/readiness',{user}),f.env)).status,403);assert.equal(f.env.TENANT_A.calls,before);}
}finally{f.close();}});

test('C10-A05 batch rejects raw SQL, unknown fields, oversized counts and periods before query execution',async()=>{const f=await fixture();try{
 for(const queries of [[],Array(13).fill(plan),[{...plan,sql:'SELECT * FROM users'}],[{...plan,metrics:['tenant_id']}],[{...plan,to:'2099-01-01'}]]){
 const before=f.env.TENANT_A.calls;const response=await batch(f,{queries});assert.equal(response.status,400);assert.equal(f.env.TENANT_A.calls,before+1); // identity check only
 }
}finally{f.close();}});

test('C10-A06 missing source, empty data and unverified coverage are separate states',async()=>{const f=await fixture({seed:false});try{
 let response=await(await batch(f)).json();assert.equal(response.results[0].meta.qualityState,'NO_PUBLISHED_DATA');
 assert.equal(response.results[0].meta.sourceCompletenessCertified,false);assert.equal(response.results[0].meta.noPublishedData,true);
}finally{f.close();}
const g=await fixture();try{
 g.env.TENANT_A.db.exec("INSERT INTO sources VALUES ('alpha','missing','Unpublished source','active')");
 const r=await(await batch(g)).json();assert.equal(r.results[0].meta.qualityState,'MISSING_SOURCE');assert.deepEqual(r.results[0].meta.missingSources,['missing']);
 assert.equal(r.results[0].meta.expectedSourceCount,2);
 g.env.TENANT_A.db.exec("UPDATE sources SET state='disabled' WHERE id='ops-demo'");
 const disabled=await(await batch(g)).json();assert.equal(disabled.results[0].meta.noPublishedData,true);assert.equal(disabled.results[0].data[0].matched_rows,0);
}finally{g.close();}});

test('C01-R02 route epoch mismatch fails before business data reads',async()=>{const f=await fixture();try{
 f.env.CONTROL_DB.db.exec("UPDATE tenants SET route_epoch=2 WHERE id='alpha'");
 const response=await batch(f);assert.equal(response.status,503);assert.equal((await response.json()).error.code,'TENANT_ROUTE_FENCED');
 f.env.TENANT_A.db.exec('UPDATE tenant_identity SET route_epoch=2');assert.equal((await batch(f)).status,200);
}finally{f.close();}});

test('C20-A02 enabled AI profile must resolve all references within target tenant',async()=>{const f=await fixture();try{
 const p=await bundle(f);p.ai.enabled=true;
 f.env.CONTROL_DB.db.prepare('INSERT INTO tenant_ai_profiles VALUES (?,?,?,?,?)').run('beta',p.ai.providerInstanceRef,p.ai.modelRef,p.ai.credentialRef,'active');
 const denied=await register(f,p);assert.equal(denied.status,403);assert.equal(f.env.PACKS.objects.size,0);
 f.env.CONTROL_DB.db.prepare('INSERT INTO tenant_ai_profiles VALUES (?,?,?,?,?)').run('alpha',p.ai.providerInstanceRef,p.ai.modelRef,p.ai.credentialRef,'active');
 const allowed=await register(f,p);assert.equal(allowed.status,201);const a=await allowed.json();assert.equal(a.attestationVerified,false);assert.equal(a.provenance,'operator-asserted');
 // Revocation between registration and activation is checked again.
 f.env.CONTROL_DB.db.exec("UPDATE tenant_ai_profiles SET state='revoked' WHERE tenant_id='alpha'");
 assert.equal((await activate(f,a.releaseId)).status,403);
}finally{f.close();}});

test('C20-R05 activation compares route epoch as well as release revision',async()=>{const f=await fixture();try{
 const rr=await register(f,await bundle(f));const release=(await rr.json()).releaseId;
 assert.equal((await activate(f,release,0,99)).status,409);assert.equal((await activate(f,release)).status,200);
}finally{f.close();}});

test('C20-A06 unsupported semantic version is rejected even when a rollback object hash is valid',async()=>{const f=await fixture();try{
 const p=await bundle(f);p.semanticVersion='commerce-unknown';const response=await register(f,p);assert.equal(response.status,400);assert.equal((await response.json()).error.code,'PACK_VERSION_UNSUPPORTED');assert.equal(f.env.PACKS.objects.size,0);
}finally{f.close();}});

test('C20 source claim is immutable even when conflicting registrations race',async()=>{const f=await fixture();try{
 const p=await bundle(f);const responses=await Promise.all([register(f,p),register(f,{...p,name:'Different content'})]);
 assert.deepEqual(responses.map(r=>r.status).sort(),[201,409]);
 assert.equal(f.env.CONTROL_DB.db.prepare("SELECT COUNT(*) n FROM tenant_releases WHERE tenant_id='alpha'").get().n,1);
 assert.equal(f.env.CONTROL_DB.db.prepare("SELECT COUNT(*) n FROM control_audit WHERE event_type='pack.registered'").get().n,1);
}finally{f.close();}});

test('C20 suspended organization cannot publish even with an active license',async()=>{const f=await fixture();try{
 f.env.CONTROL_DB.db.exec("UPDATE tenants SET state='suspended' WHERE id='alpha'");
 const response=await register(f,await bundle(f));assert.equal(response.status,403);assert.equal(f.env.PACKS.objects.size,0);
}finally{f.close();}});

test('C20-A05 UI dashboard ID lookup does not return unrelated Git dashboards',async()=>{const f=await fixture();try{
 const rr=await register(f,await bundle(f));await activate(f,(await rr.json()).releaseId);
 const result=await f.api(request('/api/tenants/alpha/dashboards/operations-cost'),f.env);assert.equal(result.status,200);
 const body=await result.json();assert.equal(body.dashboards.length,1);assert.equal(body.dashboards[0].id,'operations-cost');assert.equal(body.dashboards[0].configurationRevision,1);
 const git=await f.api(request('/api/tenants/alpha/dashboards/git-ops'),f.env);assert.equal(git.headers.get('etag'),'"1"');
}finally{f.close();}});

test('C10-R01 dashboard authoring cannot introduce metrics excluded by active pack',async()=>{const f=await fixture();try{
 const p=await bundle(f);p.allowedMetrics=['cases'];p.queries=[];p.dashboards[0].definition={version:1,title:'Cases only',widgets:[f.dashboard.widgets[0]]};
 const rr=await register(f,p);assert.equal(rr.status,201);await activate(f,(await rr.json()).releaseId);
 const response=await f.api(request('/api/tenants/alpha/dashboards',{method:'POST',body:{id:'denied-metrics',definition:f.dashboard}}),f.env);assert.equal(response.status,403);
 const query=await batch(f,{configurationRelease:(await(await f.api(request('/api/tenants/alpha/configuration'),f.env)).json()).active.releaseId,configurationRevision:1});assert.equal(query.status,403);
}finally{f.close();}});

test('readiness never claims live commerce or inference from synthetic operations data',async()=>{const f=await fixture();try{
 const r=await(await f.api(request('/api/tenants/alpha/readiness'),f.env)).json();assert.equal(r.stage,'foundation');assert(r.connectors.every(c=>c.certification==='NOT_IMPLEMENTED'));assert.equal(r.askLumi.inferenceImplemented,false);assert(!('metrics' in r));
}finally{f.close();}});

test('pack byte limit handles multibyte Vietnamese input, not character count',async()=>{const f=await fixture();try{
 const p=await bundle(f);p.name='ệ'.repeat(100);p.ai.prompt='ệ'.repeat(6000);
 const valid=parseTenantPack(p);assert.equal(valid.ai.prompt.length,6000);
 const wide=structuredClone(p);wide.dashboards=Array.from({length:12},(_,i)=>({id:'dash-'+i,definition:{...p.dashboards[0].definition,title:'ệ'.repeat(100),widgets:p.dashboards[0].definition.widgets.map(w=>({...w,title:'ệ'.repeat(120)}))}}));assert.throws(()=>parseTenantPack(wide),/PACK_TOO_LARGE/);
}finally{f.close();}});

test('C10-A03 concurrent publication never mixes widget totals or lineage',async()=>{const f=await fixture();try{
 const oldHash=f.env.TENANT_A.db.prepare('SELECT content_hash FROM snapshots LIMIT 1').get().content_hash;
 const payload={sourceId:'ops-demo',observedThrough:'2026-09-20',records:[{recordId:'replacement',day:'2026-09-20',workflow:'ops',cases:1,baselineMinutes:10,humanMinutes:2,runtimeCostVnd:0,supportCostVnd:0,cashSavingsVnd:0}]};
 const [response,publication]=await Promise.all([batch(f),f.api(request('/api/tenants/alpha/imports',{method:'POST',body:payload,headers:{'idempotency-key':'publish-while-dashboard'}}),f.env)]);
 assert.equal(publication.status,201);assert.equal(response.status,200);const result=await response.json();const sum=result.results[0].data[0].cases;
 assert([450,1].includes(sum));assert.equal(result.results[1].data.reduce((n,r)=>n+r.cases,0),sum);
 assert.equal(result.results[0].meta.provenance[0].content_hash===oldHash,sum===450);
 assert.equal(new Set(result.results.map(r=>r.meta.contextHash)).size,1);
}finally{f.close();}});

test('enabled AI profile revocation invalidates active release reads before data access',async()=>{const f=await fixture();try{
 const p=await bundle(f);p.ai.enabled=true;
 f.env.CONTROL_DB.db.prepare('INSERT INTO tenant_ai_profiles VALUES (?,?,?,?,?)').run('alpha',p.ai.providerInstanceRef,p.ai.modelRef,p.ai.credentialRef,'active');
 const rr=await register(f,p);const release=(await rr.json()).releaseId;assert.equal((await activate(f,release)).status,200);
 f.env.CONTROL_DB.db.exec("UPDATE tenant_ai_profiles SET state='revoked' WHERE tenant_id='alpha'");const before=f.env.TENANT_A.calls;
 const response=await f.api(request('/api/tenants/alpha/metrics'),f.env);assert.equal(response.status,403);assert.equal(f.env.TENANT_A.calls,before);
}finally{f.close();}});
