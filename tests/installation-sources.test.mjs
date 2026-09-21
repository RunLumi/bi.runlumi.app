import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LocalDatabase,request} from '../scripts/local-adapters.mjs';
import {createApi} from '../packages/core/src/api.ts';

test('standalone source registry uses ordinary paths and installation-local authorization',async()=>{
 const db=new LocalDatabase();db.db.exec(await readFile(new URL('../migrations/installation/0001_initial.sql',import.meta.url),'utf8'));
 db.db.exec("INSERT INTO installation VALUES(1,'Acme','2026-09-21T00:00:00Z','0.1.0'); INSERT INTO users VALUES('owner','local','owner','Owner','owner','active','2026-09-21','2026-09-21'); INSERT INTO users VALUES('viewer','local','viewer','Viewer','viewer','active','2026-09-21','2026-09-21');");
 const env={DB:db,SOURCES:{async get(){return null;},async put(){}},ASSETS:{async fetch(){return new Response('asset');}},DEPLOYMENT_ID:'local',ENVIRONMENT:'test'};
 const apiFor=subject=>createApi(async()=>({issuer:'local',subject}),true,{standalone:true});
 try{
  let response=await apiFor('owner')(request('/api/sources',{method:'POST',body:{id:'erp',name:'ERP export'}}),env);assert.equal(response.status,201,await response.text());
  response=await apiFor('viewer')(request('/api/sources'),env);assert.equal(response.status,200);assert.equal((await response.json()).sources[0].id,'erp');
  response=await apiFor('viewer')(request('/api/sources',{method:'POST',body:{id:'blocked',name:'No'}}),env);assert.equal(response.status,403);
  response=await apiFor('owner')(request('/api/sources/erp',{method:'PUT',body:{state:'disabled'}}),env);assert.equal(response.status,200);
 }finally{db.close();}
});
