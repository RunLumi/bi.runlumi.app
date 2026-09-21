import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LocalDatabase,request} from '../scripts/local-adapters.mjs';
import {createApi} from '../packages/core/src/api.ts';

test('standalone API exposes one-time setup and installation session creation', async()=>{
 const db=new LocalDatabase();db.db.exec(await readFile(new URL('../migrations/installation/0001_initial.sql',import.meta.url),'utf8'));
 const env={DB:db,SOURCES:{async get(){return null;},async put(){}},ASSETS:{async fetch(){return new Response('asset');}},DEPLOYMENT_ID:'local',ENVIRONMENT:'test'};
 const api=createApi(async()=>({issuer:'local',subject:'admin'}),false,{standalone:true});
 try{
  let response=await api(request('/api/setup/status'),env);assert.equal(response.status,200);assert.equal((await response.json()).initialized,false);
  response=await api(request('/api/setup',{method:'POST',body:{name:'Acme',displayName:'Admin'}}),env);assert.equal(response.status,201);
  response=await api(request('/api/setup',{method:'POST',body:{name:'Again',displayName:'Admin'}}),env);assert.equal(response.status,409);
  response=await api(request('/api/auth/session',{method:'POST',body:{}}),env);assert.equal(response.status,200);assert.match(response.headers.get('set-cookie')??'',/^lumi_session=/);
  response=await api(request('/api/session'),env);assert.equal(response.status,200);const sessionBody=await response.json();assert.equal(sessionBody.user.role,'owner');assert.equal('installations' in sessionBody,false);
  response=await api(request('/api/users',{method:'GET'}),env);assert.equal(response.status,200);assert.equal((await response.json()).users.length,1);
  response=await api(request('/api/users',{method:'POST',body:{issuer:'local',subject:'viewer',displayName:'Viewer',role:'viewer'}}),env);assert.equal(response.status,201);const created=await response.json();
  response=await api(request('/api/users/'+created.user.id,{method:'PUT',body:{state:'disabled'}}),env);assert.equal(response.status,200);
  const viewerApi=createApi(async()=>({issuer:'local',subject:'viewer'}),false,{standalone:true});
  response=await viewerApi(request('/api/users',{method:'GET'}),env);assert.equal(response.status,403);
 }finally{db.close();}
});
