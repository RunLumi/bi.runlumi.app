import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LocalDatabase,LocalObjects,request} from '../scripts/local-adapters.mjs';
import {createApi} from '../packages/core/src/api.ts';

test('standalone reports and imports use the installation database without installation-qualified paths',async()=>{
 const db=new LocalDatabase();db.db.exec(await readFile(new URL('../migrations/installation/0001_initial.sql',import.meta.url),'utf8'));db.db.exec("INSERT INTO installation VALUES(1,'Acme','2026-09-21T00:00:00Z','0.1.0'); INSERT INTO users VALUES('owner','local','owner','Owner','owner','active','2026-09-21','2026-09-21'); INSERT INTO sources VALUES('ops','Operations','active');");
 const env={DB:db,SOURCES:new LocalObjects(),ASSETS:{async fetch(){return new Response('asset');}},DEPLOYMENT_ID:'local',ENVIRONMENT:'test'};const api=createApi(async()=>({issuer:'local',subject:'owner'}),false,{standalone:true});
 const snapshot={sourceId:'ops',observedThrough:'2026-09-20',records:[{recordId:'r1',day:'2026-09-20',workflow:'support',cases:2,baselineMinutes:120,humanMinutes:30,runtimeCostVnd:10,supportCostVnd:5,cashSavingsVnd:0,cashEvidenceRef:null}]};
 try{
  let response=await api(request('/api/imports',{method:'POST',body:snapshot,headers:{'idempotency-key':'install-1'}}),env);assert.equal(response.status,201);
  response=await api(request('/api/query',{method:'POST',body:{metrics:['cases','released_hours'],from:'2026-09-01',to:'2026-10-01',groupBy:'none'}}),env);assert.equal(response.status,200);const report=await response.json();assert.equal(report.data[0].cases,2);assert.equal(report.data[0].released_hours,1.5);
  response=await api(request('/api/imports'),env);assert.equal(response.status,200);assert.equal((await response.json()).imports.length,1);
 }finally{db.close();}
});
