import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,request} from '../scripts/local-adapters.mjs';
import {effectiveFeatures,parseLicense} from '@runlumi/core/licensing.ts';
import {parseTenantPack} from '@runlumi/core/tenant-pack.ts';
const now=Date.parse('2026-09-20T00:00:00.000Z');
const license=(extra={})=>({plan_id:'pilot',state:'active',starts_at:'2026-01-01T00:00:00.000Z',ends_at:'2026-10-01T00:00:00.000Z',grace_ends_at:null,features:JSON.stringify(['bi.read','dashboard.edit','git.publish']),...extra});
const pack=(dashboard,name='Tenant pack')=>({schemaVersion:1,semanticVersion:'operations-v1',name,allowedMetrics:['cases','released_hours','cash_savings_vnd','net_cash_benefit_vnd','runtime_cost_vnd','baseline_hours','human_hours'],dashboards:[{id:'operations-cost',definition:dashboard}],queries:[{id:'hours',metrics:['released_hours'],groupBy:'workflow'}],ai:{enabled:false,providerInstanceRef:'primary',modelRef:'analyst-v1',credentialRef:'opaque-ref',dailyBudgetUsd:5,contextMode:'authorized-results-only',prompt:'Interpret only authorized metric results. Capacity is not cash.'}});
const call=(f,path,options={})=>f.api(request('/api/control'+path,{user:'platform-admin',...options}),f.env);
async function register(f,tenant='alpha',commit='a'.repeat(40),title='Tenant pack'){
 f.env.CONTROL_DB.db.prepare('INSERT OR IGNORE INTO pack_sources VALUES (?,?,?)').run(tenant,'RunLumi/configs','tenants/'+tenant);
 const response=await call(f,`/tenants/${tenant}/releases`,{method:'POST',body:{repository:'RunLumi/configs',sourcePath:'tenants/'+tenant,sourceCommit:commit,pack:pack({...f.dashboard,title},title)}});
 assert.equal(response.status,201,await response.clone().text());return(await response.json()).releaseId;
}
const activate=(f,releaseId,rev=0,tenant='alpha')=>call(f,`/tenants/${tenant}/activation`,{method:'POST',headers:{'if-match':`"${rev}"`},body:{releaseId,routeEpoch:1,reason:'Reviewed configuration release'}});
test('license windows and grace distinguish read access from write permission',()=>{
 assert.deepEqual(effectiveFeatures(license(),now),['bi.read','dashboard.edit','git.publish']);
 for(const state of ['suspended','cancelled'])assert.deepEqual(effectiveFeatures(license({state,grace_ends_at:'2027-01-01T00:00:00.000Z'}),now),[]);
 assert.deepEqual(effectiveFeatures(license({ends_at:'2026-09-19T00:00:00.000Z',grace_ends_at:'2026-09-21T00:00:00.000Z'}),now),['bi.read']);
 assert.deepEqual(effectiveFeatures(license({starts_at:'2026-09-21T00:00:00.000Z'}),now),[]);
 assert.deepEqual(effectiveFeatures(null,now),[]);
 assert.deepEqual(effectiveFeatures(license({features:'["admin"]'}),now),[]);
});
test('invalid license state/features and negative windows rejected',()=>{
 for(const bad of [{state:'paid-forever'},{features:['bi.read','admin']},{ends_at:'2025-01-01T00:00:00.000Z'}])assert.throws(()=>parseLicense({...license(),...bad}));
});
test('operator sees all control metadata but receives no implicit BI access',async()=>{const f=await fixture();try{
 const r=await call(f,'/overview');assert.equal(r.status,200);const b=await r.json();assert.equal(b.tenants.length,2);assert.equal(b.users.length,7);assert(!JSON.stringify(b).includes('baselineMinutes'));
 assert.equal((await f.api(request('/api/tenants/alpha/metrics',{user:'platform-admin'}),f.env)).status,403);
 assert.equal((await call(f,'/overview',{user:'alpha-owner'})).status,403);
}finally{f.close();}});
test('license revocation and user disable block requests before tenant database access',async()=>{const f=await fixture();try{
 f.env.CONTROL_DB.db.exec("UPDATE licenses SET state='suspended' WHERE tenant_id='alpha'");const before=f.env.TENANT_A.calls;
 assert.equal((await f.api(request('/api/tenants/alpha/metrics'),f.env)).status,403);assert.equal(f.env.TENANT_A.calls,before);
 f.env.CONTROL_DB.db.exec("UPDATE licenses SET state='active'; UPDATE users SET state='disabled' WHERE subject='alpha-owner'");
 assert.equal((await f.api(request('/api/tenants/alpha/metrics'),f.env)).status,403);assert.equal(f.env.TENANT_A.calls,before);
}finally{f.close();}});
test('cell fails closed if control service is unavailable',async()=>{const f=await fixture();try{const before=f.env.TENANT_A.calls;f.env.CONTROL={fetch:async()=>{throw new Error('outage');}};const r=await f.api(request('/api/tenants/alpha/metrics'),f.env);assert.equal(r.status,503);assert.equal(f.env.TENANT_A.calls,before);}finally{f.close();}});
test('license modification needs platform operator, strong revision and audit',async()=>{const f=await fixture();try{
 const body={license:{...license({ends_at:'2099-01-01T00:00:00.000Z',state:'suspended'}),features:['bi.read','git.publish']},reason:'Contract suspended'};
 assert.equal((await call(f,'/tenants/alpha/license',{method:'PUT',user:'alpha-owner',body,headers:{'if-match':'"1"'}})).status,403);
 assert.equal((await call(f,'/tenants/alpha/license',{method:'PUT',body})).status,428);
 assert.equal((await call(f,'/tenants/alpha/license',{method:'PUT',body,headers:{'if-match':'"1"'}})).status,200);
 assert.equal((await call(f,'/tenants/alpha/license',{method:'PUT',body,headers:{'if-match':'"1"'}})).status,409);
 assert.equal(f.env.CONTROL_DB.db.prepare("SELECT COUNT(*) n FROM control_audit WHERE event_type='license.updated'").get().n,1);
}finally{f.close();}});
test('pack registration refuses unknown source and tenant-supplied code or endpoints',async()=>{const f=await fixture();try{
 const p=pack(f.dashboard);assert.throws(()=>parseTenantPack({...p,sql:'select * from users'}));assert.throws(()=>parseTenantPack({...p,ai:{...p.ai,apiKey:'secret'}}));assert.throws(()=>parseTenantPack({...p,ai:{...p.ai,endpoint:'https://example.com'}}));
 const r=await call(f,'/tenants/alpha/releases',{method:'POST',body:{repository:'evil/repo',sourcePath:'tenant',sourceCommit:'a'.repeat(40),pack:p}});assert.equal(r.status,403);assert.equal(f.env.PACKS.objects.size,0);
}finally{f.close();}});
test('register, activate and rollback alpha configuration without modifying beta or facts',async()=>{const f=await fixture();try{
 const betaBefore=await(await f.api(request('/api/tenants/beta/dashboards',{user:'beta-owner'}),f.env)).text();const facts=f.env.TENANT_A.db.prepare('SELECT COUNT(*) n FROM workflow_facts').get().n;
 const first=await register(f);assert.equal((await activate(f,first)).status,200);
 const list=await(await f.api(request('/api/tenants/alpha/dashboards'),f.env)).json();assert.equal(list.dashboards[0].management,'git');assert.equal(list.dashboards[0].releaseId,first);
 const second=await register(f,'alpha','b'.repeat(40),'Version two');assert.equal((await activate(f,second,1)).status,200);assert.equal((await activate(f,first,1)).status,409);assert.equal((await activate(f,first,2)).status,200);
 const config=await(await f.api(request('/api/tenants/alpha/configuration'),f.env)).json();assert.equal(config.active.releaseId,first);assert.equal(config.active.revision,3);assert.equal(config.active.ai.inferenceImplemented,false);assert(!JSON.stringify(config).includes('opaque-ref'));
 assert.equal(await(await f.api(request('/api/tenants/beta/dashboards',{user:'beta-owner'}),f.env)).text(),betaBefore);assert.equal(f.env.TENANT_A.db.prepare('SELECT COUNT(*) n FROM workflow_facts').get().n,facts);
 assert.equal((await activate(f,first,0,'beta')).status,404);
}finally{f.close();}});
test('Git managed dashboard cannot be overwritten through UI endpoint',async()=>{const f=await fixture();try{const release=await register(f);await activate(f,release);const r=await f.api(request('/api/tenants/alpha/dashboards/operations-cost',{method:'PUT',body:f.dashboard,headers:{'if-match':'"1"'}}),f.env);assert.equal(r.status,409);assert.equal((await r.json()).error.code,'GIT_MANAGED_DASHBOARD');}finally{f.close();}});
test('tampered R2 configuration refuses access instead of serving builtin fallback',async()=>{const f=await fixture();try{const release=await register(f);await activate(f,release);for(const key of f.env.PACKS.objects.keys())f.env.PACKS.objects.set(key,'{}');const r=await f.api(request('/api/tenants/alpha/metrics'),f.env);assert.equal(r.status,503);}finally{f.close();}});
test('concurrent activation permits only one revision winner and one audit event',async()=>{const f=await fixture();try{const release=await register(f);const r=await Promise.all([activate(f,release),activate(f,release)]);assert.deepEqual(r.map(x=>x.status).sort(),[200,409]);assert.equal(f.env.CONTROL_DB.db.prepare("SELECT COUNT(*) n FROM control_audit WHERE event_type='pack.activated'").get().n,1);}finally{f.close();}});
test('source commit is immutable and repeated registration reuses release',async()=>{const f=await fixture();try{const release=await register(f);const body={repository:'RunLumi/configs',sourcePath:'tenants/alpha',sourceCommit:'a'.repeat(40),pack:pack({...f.dashboard,title:'Tenant pack'})};
 const repeated=await call(f,'/tenants/alpha/releases',{method:'POST',body});assert.equal(repeated.status,200);assert.equal((await repeated.json()).releaseId,release);
 const changed=await call(f,'/tenants/alpha/releases',{method:'POST',body:{...body,pack:{...body.pack,name:'different'}}});assert.equal(changed.status,409);
}finally{f.close();}});
