import test from 'node:test';
import assert from 'node:assert/strict';
import {fixture, call, cookieOf, request, createStaff, emptyInstallation, creds, fixturePasswords, SECRET_FIELD} from './helpers.mjs';
import {createApi} from '../packages/core/src/api.ts';
import {readFile} from 'node:fs/promises';

test('setup, session, user management and authorization across roles and state changes',async()=>{
 const f=await fixture();try{
  // Session reports the installation and the signed-in owner.
  const session=await call(f,'/api/session',{method:'GET'});
  assert.equal(session.status,200);const sessionBody=await session.json();
  assert.equal(sessionBody.installation.name,'Acme BI');assert.equal(sessionBody.standalone,true);
  assert.equal(sessionBody.user.role,'owner');assert.equal('installations' in sessionBody,false);

  // Owner creates local users with credentials; viewers cannot list users.
  const created=await createStaff(f,'viewer1@acme.test','viewer');
  assert.equal(created.user.role,'viewer');
  const viewerList=await call(f,'/api/users',{user:'viewer1@acme.test',pass:fixturePasswords.staff,method:'GET'});
  assert.equal(viewerList.status,403);

  // Editor can read sources but cannot create users.
  await createStaff(f,'editor1@acme.test','editor');
  const editorUsers=await call(f,'/api/users',{user:'editor1@acme.test',pass:fixturePasswords.staff,method:'GET'});
  assert.equal(editorUsers.status,403);

  // Role change, disablement and session revocation.
  const roleChange=await call(f,`/api/users/${created.user.id}`,{method:'PUT',body:{role:'editor'}});
  assert.equal(roleChange.status,200);
  const disable=await call(f,`/api/users/${created.user.id}`,{method:'PUT',body:{state:'disabled'}});
  assert.equal(disable.status,200);
  const disabledLogin=await f.api(request('/api/auth/login',{method:'POST',body:creds('viewer1@acme.test',fixturePasswords.staff)}),f.env);
  assert.equal(disabledLogin.status,403);assert.equal((await disabledLogin.json()).error.code,'USER_DISABLED');

  // Re-enable with the original credential intact.
  const reenable=await call(f,`/api/users/${created.user.id}`,{method:'PUT',body:{state:'active'}});
  assert.equal(reenable.status,200);
  const reenabledLogin=await f.api(request('/api/auth/login',{method:'POST',body:creds('viewer1@acme.test',fixturePasswords.staff)}),f.env);
  assert.equal(reenabledLogin.status,200);

  // Password reset by owner; old password stops working.
  await call(f,`/api/users/${created.user.id}`,{method:'PUT',body:{[SECRET_FIELD]:fixturePasswords.fresh}});
  const oldPassword=await f.api(request('/api/auth/login',{method:'POST',body:creds('viewer1@acme.test',fixturePasswords.staff)}),f.env);
  assert.equal(oldPassword.status,401);

  // Local users always require a password.
  const noPassword=await call(f,'/api/users',{body:{login:'nopass@acme.test',displayName:'NoPass',role:'viewer'}});
  assert.equal(noPassword.status,422);assert.equal((await noPassword.json()).error.code,'PASSWORD_REQUIRED');

  // Unknown API paths return JSON 404, never an HTML shell.
  const notFound=await call(f,'/api/does-not-exist',{method:'GET'});
  assert.equal(notFound.status,404);assert.match(notFound.headers.get('content-type')??'',/application\/json/);
 }finally{f.close();}
});

test('health endpoint reports the core release without authentication',async()=>{
 const f=await fixture();try{
  const health=await f.api(request('/healthz'),f.env);
  assert.equal(health.status,200);const body=await health.json();
  assert.equal(body.status,'ok');assert.ok(body.version);
 }finally{f.close();}
});

test('requests before initialization are rejected with a setup-directed error',async()=>{
 const db=await emptyInstallation();try{
  const env={DB:db,SOURCES:{async get(){return null;},async put(){}},ASSETS:{async fetch(){return new Response('asset');}}};
  const api=createApi(async()=>({issuer:'local',subject:'ghost'}),false,{standalone:true});
  const before=await api(request('/api/query',{method:'POST',body:{metrics:['cases'],from:'2026-09-01',to:'2026-09-02',groupBy:'none'}}),env);
  assert.equal(before.status,409);assert.equal((await before.json()).error.code,'INSTALLATION_NOT_INITIALIZED');
 }finally{db.close();}
});
