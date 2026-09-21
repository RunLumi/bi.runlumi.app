#!/usr/bin/env node
/** workerd runtime check for packaged core artifacts.
 * Installs the exact tarballs into a temporary directory, applies the real
 * installation migrations to a local D1 database and runs a thin Worker entry
 * (composed only from packaged public interfaces) under real workerd via
 * `wrangler dev --local`. No Cloudflare account, API token or billable resource
 * is used. This is local runtime evidence, not authenticated staging certification. */
import {mkdtemp, writeFile, mkdir, rm, readFile} from 'node:fs/promises';
import {spawn, spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import process from 'node:process';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const npm=process.env.npm_execpath??process.env.LUMI_NPM_BIN??'npm';
const wrangler=process.env.LUMI_WRANGLER_BIN??path.join(root,'node_modules','.bin','wrangler');
const artifacts=path.join(root,'artifacts/core');
const work=await mkdtemp(path.join(tmpdir(),'lumi-workerd-'));
const port=8799;

let server;let output='';
try{
 await mkdir(path.join(work,'src'),{recursive:true});
 const worker=await readFile(path.join(root,'scripts/fixtures/workerd-worker.ts'),'utf8');
 await writeFile(path.join(work,'src/index.ts'),worker);
 await writeFile(path.join(work,'package.json'),JSON.stringify({name:'workerd-check',private:true,type:'module',dependencies:{'@runlumi/core':`file:${artifacts}/runlumi-core-0.1.0.tgz`,'@runlumi/cloudflare':`file:${artifacts}/runlumi-cloudflare-0.1.0.tgz`},devDependencies:{'@types/node':'22.18.6'}},null,2));
 await writeFile(path.join(work,'wrangler.jsonc'),JSON.stringify({
  name:'workerd-check',main:'src/index.ts',compatibility_date:'2026-08-18',workers_dev:false,preview_urls:false,routes:[],
  assets:{directory:'public',binding:'ASSETS',not_found_handling:'single-page-application',run_worker_first:['/api/*','/healthz']},
  vars:{DEPLOYMENT_ID:'workerd-check',ENVIRONMENT:'local-check'},
  d1_databases:[{binding:'DB',database_name:'workerd-check-db',database_id:'00000000-0000-0000-0000-000000000000',migrations_dir:'node_modules/@runlumi/core/migrations/installation'}],
  r2_buckets:[{binding:'SOURCES',bucket_name:'workerd-check-sources'}]
 },null,2));
 await mkdir(path.join(work,'public'),{recursive:true});
 await writeFile(path.join(work,'public/index.html'),'<!doctype html><title>static</title>');
 // Install exact packaged tarballs.
 const install=spawnSync(npm,['install','--ignore-scripts','--save-exact'],{cwd:work,encoding:'utf8'});
 if(install.status!==0)throw new Error(`install failed: ${install.stdout}${install.stderr}`);
 // Apply the real installation migrations to the local D1 database.
 for(const file of ['0001_initial.sql','0002_credentials_and_commerce.sql']){
  const applied=spawnSync(wrangler,['d1','execute','DB','--local','--config','wrangler.jsonc','--file',path.join(work,'node_modules','@runlumi','core','migrations','installation',file)],{cwd:work,encoding:'utf8'});
  if(applied.status!==0)throw new Error(`migration ${file} failed: ${applied.stdout}${applied.stderr}`);
 }
 // Start workerd. wrangler dev runs a local workerd; --local forbids remote resources.
 server=spawn(wrangler,['dev','--config','wrangler.jsonc','--port',String(port),'--ip','127.0.0.1'],{cwd:work,stdio:['ignore','pipe','pipe']});
 output='';server.stdout.on('data',d=>output+=d);server.stderr.on('data',d=>output+=d);
 const deadline=Date.now()+60_000;
 let ready=false;
 while(Date.now()<deadline){
  try{const r=await fetch(`http://127.0.0.1:${port}/healthz`);if(r.ok){ready=true;break;}}catch{}
  await new Promise(r=>setTimeout(r,500));
 }
 if(!ready)throw new Error(`workerd did not start. Output:\n${output.slice(-2000)}`);
 const results=[];
 const probe=async(name,fn)=>{try{await fn();results.push(`PASS ${name}`);}catch(e){results.push(`FAIL ${name}: ${e.message}`);throw e;}};
 const get=(p,headers={})=>fetch(`http://127.0.0.1:${port}${p}`,{headers});
 await probe('packaged core evaluates in real workerd and reports readiness',async()=>{
  const r=await get('/healthz');assert.equal(r.status,200);assert.equal((await r.json()).status,'ok');
 });
 await probe('real local D1 serves the migration-backed setup status',async()=>{
  const r=await get('/api/setup/status');assert.equal(r.status,200);assert.equal((await r.json()).initialized,false);
 });
 await probe('API without a session fails closed in the real runtime',async()=>{
  const r=await get('/api/session');assert.equal(r.status,401);assert.equal((await r.json()).error.code,'UNAUTHENTICATED');
 });
 await probe('unconfigured Access issuer fails closed rather than trusting a header',async()=>{
  const r=await get('/api/session',{'cf-access-jwt-assertion':'not-a-jwt','x-demo-user':'owner'});
  assert.equal(r.status,401,'a demo/header shortcut must never authenticate');
 });
 await probe('first-run setup and direct sign-in complete against real D1',async()=>{
  let r=await fetch(`http://127.0.0.1:${port}/api/setup`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'Workerd check',login:'owner@check.test',displayName:'Owner',password:['workerd','check','1'].join('-')})});
  assert.equal(r.status,201,await r.text());
  const cookie=(r.headers.get('set-cookie')??'').split(';')[0];
  r=await get('/api/session',{cookie});assert.equal(r.status,200);
  const session=await r.json();
  assert.equal(session.user.subject,'owner@check.test');assert.equal(session.user.role,'owner');
  r=await get('/api/setup/status');assert.equal((await r.json()).initialized,true,'setup must be permanently closed');
 });
 await probe('an unknown API path returns JSON, never the HTML shell',async()=>{
  const r=await get('/api/does-not-exist');const type=r.headers.get('content-type')??'';
  assert(type.includes('application/json'),'API errors must not fall through to HTML');assert(!type.includes('text/html'));
 });
 await probe('static assets are served for non-API paths',async()=>{
  const r=await get('/');assert.equal(r.status,200);assert((await r.text()).includes('static'));
 });
 console.log(results.join('\n'));
 console.log(`\nworkerd runtime: ${results.filter(r=>r.startsWith('PASS')).length}/${results.length} checks passed (local workerd + local D1, not authenticated staging).`);
}catch(error){
 console.error(`workerd check failed: ${error.message}`);
 if(output)console.error(`--- worker output (tail) ---\n${output.slice(-4000)}`);
 process.exitCode=1;
}finally{
 if(server)server.kill('SIGTERM');
 if(process.env.LUMI_KEEP_WORKERD!=='1')await new Promise(r=>setTimeout(r,1500)).then(()=>rm(work,{recursive:true,force:true}).catch(()=>{}));
 else console.log(`workerd workspace retained at ${work}`);
}
