import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture,request} from '../scripts/local-adapters.mjs';

const call=(f,path,options={})=>f.api(request('/api/control'+path,{user:'platform-admin',...options}),f.env);
const change=(f,state,revision,reason='reviewed lifecycle transition')=>call(f,'/tenants/alpha/lifecycle',{method:'PUT',headers:{'if-match':`"${revision}"`},body:{state,reason}});

test('lifecycle is visible, optimistic and fences tenant access',async()=>{
 const f=await fixture();try{
  const overview=await (await call(f,'/overview')).json(),tenant=overview.tenants.find(x=>x.id==='alpha');assert.equal(tenant.lifecycle_state,'ACTIVE');assert.equal(tenant.lifecycle_revision,1);
  assert.equal((await change(f,'SUSPENDED',1)).status,200);
  const session=await (await f.api(request('/api/session'),f.env)).json();assert.equal(session.tenants.some(x=>x.id==='alpha'),false);
  assert.equal((await f.api(request('/api/tenants/alpha/metrics'),f.env)).status,403);
  assert.equal((await change(f,'ACTIVE',2)).status,200);assert.equal((await f.api(request('/api/tenants/alpha/metrics'),f.env)).status,200);
 }finally{f.close();}
});

test('lifecycle transitions reject invalid or stale operator writes without side effects',async()=>{
 const f=await fixture();try{
  assert.equal((await change(f,'DELETED',1)).status,409);
  assert.equal((await change(f,'SUSPENDED',1)).status,200);
  assert.equal((await change(f,'ACTIVE',1)).status,409);
  assert.equal((await call(f,'/tenants/alpha/lifecycle',{method:'PUT',body:{state:'ACTIVE',reason:'missing revision'}})).status,428);
  assert.equal(f.env.CONTROL_DB.db.prepare('SELECT state,revision FROM tenant_lifecycle WHERE tenant_id=?').get('alpha').state,'SUSPENDED');
  assert.equal(f.env.CONTROL_DB.db.prepare('SELECT state,revision FROM tenant_lifecycle WHERE tenant_id=?').get('alpha').revision,2);
 }finally{f.close();}
});

test('lifecycle is operator-only and records an auditable state transition',async()=>{
 const f=await fixture();try{
  assert.equal((await call(f,'/tenants/alpha/lifecycle',{user:'alpha-owner',method:'PUT',headers:{'if-match':'"1"'},body:{state:'SUSPENDED',reason:'owner attempt'}})).status,403);
  assert.equal((await change(f,'SUSPENDED',1,'source access paused')).status,200);
  const event=f.env.CONTROL_DB.db.prepare("SELECT event_type,resource_id,reason FROM control_audit WHERE event_type='tenant.lifecycle'").get();assert.equal(event.event_type,'tenant.lifecycle');assert.equal(event.resource_id,'alpha');assert.equal(event.reason,'source access paused');
 }finally{f.close();}
});

test('deleting fences access but does not pretend to erase tenant data',async()=>{
 const f=await fixture();try{
  assert.equal((await change(f,'DELETING',1,'approved offboarding')).status,200);
  assert.equal((await change(f,'DELETED',2,'offboarding complete')).status,200);
  assert.equal((await f.api(request('/api/tenants/alpha/metrics'),f.env)).status,403);
  assert.equal(f.env.TENANT_A.db.prepare('SELECT COUNT(*) AS n FROM workflow_facts').get().n>0,true);
  assert.equal((await change(f,'ACTIVE',3)).status,409);
 }finally{f.close();}
});
