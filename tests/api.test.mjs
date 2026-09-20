import test from 'node:test';import assert from 'node:assert/strict';import {readFile} from 'node:fs/promises';
import {fixture,request} from '../scripts/local-adapters.mjs';
import prod from '../apps/api/src/index.ts';
const query={metrics:['cases','released_hours','runtime_cost_vnd','cash_savings_vnd','net_cash_benefit_vnd'],from:'2026-09-01',to:'2026-10-01',groupBy:'none'};
const sample=JSON.parse(await readFile(new URL('../fixtures/alpha.json',import.meta.url),'utf8'));
async function withFixture(fn,options){const f=await fixture(options);try{await fn(f);}finally{f.close();}}
test('two tenants get different correct values with identical record IDs',()=>withFixture(async({api,env})=>{
 const a=await(await api(request('/api/tenants/alpha/query',{method:'POST',body:query}),env)).json();
 const b=await(await api(request('/api/tenants/beta/query',{method:'POST',body:query,user:'beta-owner'}),env)).json();
 assert.equal(a.data[0].cases,450);assert.equal(b.data[0].cases,1350);assert.equal(a.data[0].released_hours,74);assert.equal(a.data[0].runtime_cost_vnd,216000);assert.equal(a.data[0].cash_savings_vnd,0);assert.equal(a.data[0].net_cash_benefit_vnd,-336000);
 assert.equal(a.meta.provenance.length,1);assert.equal(a.meta.provenance[0].observed_through,'2026-09-18');
}));
for(const endpoint of ['metrics','dashboards','imports','query'])test(`cross-tenant ${endpoint} denied BEFORE data access`,()=>withFixture(async({api,env})=>{
 const before=env.TENANT_B.calls;const writes=env.SOURCES.objects.size;
 const response=await api(request(`/api/tenants/beta/${endpoint}`,endpoint==='query'?{method:'POST',body:query}:{}),env);
 assert.equal(response.status,403);assert.equal(env.TENANT_B.calls,before);assert.equal(env.SOURCES.objects.size,writes);
}));
test('wrong database routing fails identity check',()=>withFixture(async({api,env})=>{const original=env.TENANT_A;env.TENANT_A=env.TENANT_B;try{assert.equal((await api(request('/api/tenants/alpha/metrics'),env)).status,503);}finally{env.TENANT_A=original;}}));
test('revoked membership is not served from cache',()=>withFixture(async({api,env})=>{await api(request('/api/tenants/alpha/metrics'),env);env.CONTROL_DB.db.exec("UPDATE memberships SET state='revoked' WHERE subject='alpha-owner'");assert.equal((await api(request('/api/tenants/alpha/metrics'),env)).status,403);}));
test('editor can edit but viewer cannot and stale revisions conflict',()=>withFixture(async({api,env,dashboard})=>{
 const path='/api/tenants/alpha/dashboards/operations-cost';
 assert.equal((await api(request(path,{method:'PUT',body:dashboard,user:'alpha-viewer',headers:{'if-match':'"1"'}}),env)).status,403);
 assert.equal((await api(request(path,{method:'PUT',body:dashboard,user:'alpha-editor',headers:{'if-match':'"1"'}}),env)).status,200);
 assert.equal((await api(request(path,{method:'PUT',body:dashboard,headers:{'if-match':'"1"'}}),env)).status,409);
 const audit=env.TENANT_A.db.prepare("SELECT count(*) c FROM audit_events WHERE event_type='dashboard.updated'").get();assert.equal(audit.c,1);
}));
test('owner-only ingestion, dedupe, conflict and full snapshot replacement',()=>withFixture(async({api,env})=>{
 const path='/api/tenants/alpha/imports';
 assert.equal((await api(request(path,{method:'POST',body:sample,user:'alpha-editor',headers:{'idempotency-key':'new-snapshot'}}),env)).status,403);
 const repeat=await(await api(request(path,{method:'POST',body:sample,headers:{'idempotency-key':'fixture-first-snapshot'}}),env)).json();assert.equal(repeat.replayed,true);
 const changed=structuredClone(sample);changed.records=changed.records.slice(0,1);
 assert.equal((await api(request(path,{method:'POST',body:changed,headers:{'idempotency-key':'fixture-first-snapshot'}}),env)).status,409);
 assert.equal((await api(request(path,{method:'POST',body:changed,headers:{'idempotency-key':'second-snapshot'}}),env)).status,201);
 const result=await(await api(request('/api/tenants/alpha/query',{method:'POST',body:query}),env)).json();assert.equal(result.data[0].cases,30);
 assert.ok([...env.SOURCES.objects.keys()].every(k=>k.startsWith('tenants/alpha/')||k.startsWith('tenants/beta/')));
}));
test('cross-tenant import cannot write R2',()=>withFixture(async({api,env})=>{const count=env.SOURCES.objects.size;const r=await api(request('/api/tenants/beta/imports',{method:'POST',body:sample,headers:{'idempotency-key':'attack-key'}}),env);assert.equal(r.status,403);assert.equal(env.SOURCES.objects.size,count);}));
test('R2 failure cannot publish a partial snapshot',()=>withFixture(async({api,env})=>{env.SOURCES.put=async()=>{throw new Error('offline');};const r=await api(request('/api/tenants/alpha/imports',{method:'POST',body:sample,headers:{'idempotency-key':'failed-object'}}),env);assert.equal(r.status,500);assert.equal(env.TENANT_A.db.prepare('SELECT count(*) c FROM snapshots').get().c,1);}));
test('D1 batch failure does not expose partially published rows',()=>withFixture(async({api,env})=>{env.TENANT_A.db.exec("CREATE TRIGGER stop_insert BEFORE INSERT ON workflow_facts BEGIN SELECT RAISE(ABORT,'blocked'); END;");const r=await api(request('/api/tenants/alpha/imports',{method:'POST',body:sample,headers:{'idempotency-key':'failed-database'}}),env);assert.equal(r.status,500);assert.equal(env.TENANT_A.db.prepare('SELECT count(*) c FROM snapshots').get().c,1);}));
test('all API data and errors are no-store',()=>withFixture(async({api,env})=>{for(const path of ['/api/tenants/alpha/metrics','/api/tenants/beta/metrics']){const r=await api(request(path),env);assert.match(r.headers.get('cache-control'),/no-store/);}}));
test('cross-origin mutations, oversized body and SQL field are rejected',()=>withFixture(async({api,env})=>{
 assert.equal((await api(request('/api/tenants/alpha/query',{method:'POST',body:query,headers:{origin:'https://evil.invalid'}}),env)).status,403);
 assert.equal((await api(request('/api/tenants/alpha/query',{method:'POST',body:{...query,sql:'SELECT *'}}),env)).status,400);
 assert.equal((await api(request('/api/tenants/alpha/query',{method:'POST',body:{payload:'x'.repeat(70000)}}),env)).status,413);
}));
test('production entry has no demo header authentication path',()=>withFixture(async({env})=>{const r=await prod.fetch(request('/api/tenants/alpha/metrics'),env);assert.equal(r.status,503);}));
test('empty datasets are explicitly labeled not silently presented as complete',()=>withFixture(async({api,env})=>{const r=await(await api(request('/api/tenants/alpha/query',{method:'POST',body:query}),env)).json();assert.equal(r.meta.noPublishedData,true);assert.deepEqual(r.meta.provenance,[]);},{seed:false}));
test('source registry is required and unknown resource keys never reach SQL',()=>withFixture(async({api,env})=>{const s={...sample,sourceId:'not-registered'};assert.equal((await api(request('/api/tenants/alpha/imports',{method:'POST',body:s,headers:{'idempotency-key':'not-a-source'}}),env)).status,400);}));
