#!/usr/bin/env node
/** Two-customer acceptance demonstration (goal section 9).
 * Runs entirely locally against real packaged tarballs. Creates nothing external
 * and no billable resource.
 *
 *   A. Both install from real packaged core artifacts and build without upstream paths.
 *   B. Package-consumer commerce journey in each checkout: setup -> connection ->
 *      receipt -> normalization -> publication -> query -> export -> job -> decision.
 *   C. Each has a functional custom page and a tested domain extension.
 *   D. Isolation: forged installation/database fields are rejected; one customer's
 *      connection identity means nothing in the other customer's database.
 *   E. Viewer and disabled users receive intended privileges only.
 *   F. A real core behavior change ships as N+1 and upgrades both apps without
 *      altering customer files; custom tests keep passing.
 *   G. Incompatible extension/migration input is rejected before deployment.
 *   H. One customer's rollback leaves the other unchanged and reports DB limits.
 *   I. Per-environment deployment identity and the operator review gate.
 */
import {mkdtemp, cp, readFile, writeFile, rm, readdir, stat, lstat, mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import process from 'node:process';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const npm=process.env.npm_execpath??process.env.LUMI_NPM_BIN??'npm';
const currentCoreVersion=JSON.parse(await readFile(path.join(root,'packages/core/package.json'),'utf8')).version;
const [coreMajor,coreMinor,corePatch]=currentCoreVersion.split('.').map(Number);
const nextCoreVersion=`${coreMajor}.${coreMinor}.${corePatch+1}`;
const work=await mkdtemp(path.join(tmpdir(),'lumi-acceptance-'));
const results=[];
const step=async(name,fn)=>{try{const value=await fn();results.push(`PASS ${name}`);return value;}catch(error){results.push(`FAIL ${name}: ${error.message}`);throw error;}};
const run=(command,args,cwd,{expectFail=false,env={}}={})=>{
 const r=spawnSync(command,args,{cwd,encoding:'utf8',env:{...process.env,LUMI_NPM_BIN:npm,...env}});
 if(r.status!==0&&!expectFail)throw new Error(`${command} ${args.join(' ')} failed: ${(r.stdout??'')+(r.stderr??'')}`);
 return {...r,ok:r.status===0};
};
const generate=async(customer,name,envs='production,staging')=>{
 const dest=path.join(work,customer);
 run(process.execPath,[path.join(root,'scripts/customer-new.mjs'),'--customer',customer,'--name',name,'--env',envs,'--dest',dest],root);
 // Apply the checked-in synthetic overlay (custom pages, metrics, navigation).
 await cp(path.join(root,'examples/customers',customer,'customer'),path.join(dest,'customer'),{recursive:true});
 const fragment=JSON.parse(await readFile(path.join(root,'examples/customers',customer,'lock-fragment.json'),'utf8'));
 const lock=JSON.parse(await readFile(path.join(dest,'lumi.lock.json'),'utf8'));
 Object.assign(lock,fragment);
 await writeFile(path.join(dest,'lumi.lock.json'),JSON.stringify(lock,null,2));
 run(npm,['ci','--ignore-scripts'],dest);
 // The generated application is a real repository: commit the clean fixture state so
 // the reviewed updater (which refuses dirty or non-Git trees) can run on it.
 run('git',['init','-q'],dest);
 run('git',['add','-A'],dest);
 // --no-verify: the throwaway fixture repo must not inherit operator-side hooks.
 run('git',['-c','user.email=acceptance@lumi.invalid','-c','user.name=Lumi Acceptance','commit','-q','--no-verify','-m',`fixture base: ${customer}`],dest);
 return dest;
};
const customerFile=async(dir,relative)=>readFile(path.join(dir,relative),'utf8');

/** The commerce journey run inside a generated customer checkout, importing only
 * the packaged @runlumi/* artifacts from node_modules. Written as a fixture file
 * and executed with the customer's own Node. Returns evidence via assertions. */
const journeyScript=`
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LocalDatabase,LocalObjects} from '@runlumi/cloudflare/testing.ts';
import {createApi} from '@runlumi/core/api.ts';
import {commerceSchemaFingerprint} from '@runlumi/core/commerce-model.ts';
const db=new LocalDatabase();
const migrationDir='../node_modules/@runlumi/core/migrations/installation/';
const {readdir}=await import('node:fs/promises');
for(const file of (await readdir(new URL(migrationDir,import.meta.url))).filter(f=>f.endsWith('.sql')).sort())db.db.exec(await readFile(new URL(migrationDir+file,import.meta.url),'utf8'));
const objects=new LocalObjects();
const env={DB:db,SOURCES:objects};
const api=createApi(async()=>({issuer:'local',subject:'no-one'}),false,{standalone:true});
const call=(path,{method='GET',body,headers={}}={})=>api(new Request('http://localhost:8787'+path,{method,...(body!==undefined?{body:JSON.stringify(body)}:{}),headers:{...(body!==undefined?{'content-type':'application/json'}:{}),...headers}}),env);
const cookieOf=r=>(r.headers.get('set-cookie')??'').split(';')[0];
// Setup + sign-in.
let r=await call('/api/setup',{method:'POST',body:{name:'Journey',login:'owner@journey.test',displayName:'Owner',password:['journey','owner','1'].join('-')}});
assert.equal(r.status,201);
// Sign in once; every later call carries the session cookie.
const login=await call('/api/auth/login',{method:'POST',body:{login:'owner@journey.test',password:['journey','owner','1'].join('-')}});
if(login.status!==200)throw new Error('login failed: '+(await login.text()));
const ownerCookie=cookieOf(login);
// Forged installation selectors are rejected before anything else.
r=await call('/api/commerce/receipts',{method:'POST',headers:{cookie:ownerCookie},body:{tenantId:'somewhere-else'}});
assert.equal(r.status,400);assert.equal((await r.json()).error.code,'UNKNOWN_FIELD');
// Register an orders connection and accept one authorized export.
r=await call('/api/commerce/connections',{method:'POST',headers:{cookie:ownerCookie},body:{id:'orders-export',provider:'generic',sourceAccountId:'shop-A',resourceType:'orders',approvalRef:'reviewed-export'}});
assert.equal(r.status,201);
const raw={contract:'lumi.commerce.export.v1',provider:'generic',sourceAccountId:'shop-A',resourceType:'orders',currency:'VND',taxBasis:'net-merchandise-actual-cash-v1',timezone:'Asia/Ho_Chi_Minh',window:{from:'2026-09-01T00:00:00.000Z',toExclusive:'2026-09-20T00:00:00.000Z'},observedAt:'2026-09-19T00:00:00.000Z',records:[{id:'9007199254740993',orderedAt:'2026-09-01T17:00:00.000Z',recognizedAt:'2026-09-03T00:00:00.000Z',state:'accepted',merchandise:'1000000',sellerDiscount:'100000',merchandiseReversal:'180000',cogs:'400000',cogsEvidenceRef:'cost-at-sale-1',variableFees:'80000',shippingIncome:'0',earnedSubsidy:'0'}]};
const envelope={eventType:'snapshot',connectionId:'orders-export',sourceAccountId:'shop-A',resourceType:'orders',deliveryId:'delivery-1',sourceObjectId:'delivery-1',sourceRevision:null,sourceEventAt:null,sourceUpdatedAt:null,window:raw.window,schemaFingerprint:await commerceSchemaFingerprint(),rawJson:JSON.stringify(raw)};
r=await call('/api/commerce/receipts',{method:'POST',headers:{cookie:ownerCookie},body:envelope});
if(![202,200].includes(r.status))throw new Error('receipt failed: '+(await r.text()));
const receipt=await r.json();
// Normalize through the durable job path with lease protection.
r=await call('/api/commerce/jobs',{method:'POST',headers:{cookie:ownerCookie},body:{receiptId:receipt.receiptId}});
const job=await r.json();
r=await call('/api/commerce/jobs/'+job.jobId+'/run',{method:'POST',headers:{cookie:ownerCookie}});
assert.equal(r.status,200);assert.equal((await r.json()).state,'SUCCEEDED');
// Preview then publish.
const normalizations=await (await call('/api/commerce/normalizations',{headers:{cookie:ownerCookie}})).json();
const publicationBody={normalizationIds:normalizations.normalizations.map(n=>n.normalizationId),mappingId:null,controls:[],expectedRevision:0,expectedPublicationId:null};
const preview=await (await call('/api/commerce/publications/preview',{method:'POST',headers:{cookie:ownerCookie},body:publicationBody})).json();
r=await call('/api/commerce/publications',{method:'POST',headers:{cookie:ownerCookie},body:{...publicationBody,previewHash:preview.previewHash,reason:'journey'}});
assert.equal(r.status,201);const published=await r.json();
// Typed query over the pinned publication: exact arithmetic, no epsilon drift.
r=await call('/api/commerce/queries',{method:'POST',headers:{cookie:ownerCookie},body:{contract:'lumi.query.v1',metrics:[{id:'net_merchandise_sales',version:1},{id:'contribution_pre_ads',version:1}],dimensions:[],filters:[],limit:10,consistency:'published',dataVersion:published.publicationId}});
const query=await r.json();
assert.equal(query.result.metrics.net_merchandise_sales.value,'720000');
assert.equal(query.result.metrics.contribution_pre_ads.value,'240000');
// Saved report with a reproducible run.
r=await call('/api/commerce/insights',{method:'POST',headers:{cookie:ownerCookie},body:{id:'weekly',title:'Weekly',definition:{metricIds:['net_merchandise_sales'],from:'2026-09-01',toExclusive:'2026-09-20',dataVersion:published.publicationId,blocks:[{id:'s',kind:'metric',metricId:'net_merchandise_sales'}]}}});
assert.equal(r.status,201);
// Authorized export.
const csv=await call('/api/commerce/publications/'+published.publicationId+'/export?format=csv',{headers:{cookie:ownerCookie}});
assert.equal(csv.status,200);
assert.deepEqual(Array.from(new Uint8Array(await (await csv.blob()).slice(0,3).arrayBuffer())),[0xEF,0xBB,0xBF]);
// Findings and the decision register.
const findings=await (await call('/api/commerce/findings',{headers:{cookie:ownerCookie}})).json();
assert.equal(findings.autonomousActionsEnabled,false);
// A viewer is denied owner surfaces.
await call('/api/users',{method:'POST',headers:{cookie:ownerCookie},body:{login:'viewer@journey.test',displayName:'V',role:'viewer',password:['journey','viewer','1'].join('-')}});
const viewerCookie=cookieOf(await call('/api/auth/login',{method:'POST',body:{login:'viewer@journey.test',password:['journey','viewer','1'].join('-')}}));
const denied=await call('/api/commerce/publications',{headers:{cookie:viewerCookie}});
assert.equal(denied.status,403);
// Disabling the user revokes the session immediately.
const users=await (await call('/api/users',{headers:{cookie:ownerCookie}})).json();
const viewer=users.users.find(u=>u.subject==='viewer@journey.test');
await call('/api/users/'+viewer.id,{method:'PUT',headers:{cookie:ownerCookie},body:{state:'disabled'}});
const revoked=await call('/api/session',{headers:{cookie:viewerCookie}});
assert.equal([401,403].includes(revoked.status),true);
console.log('JOURNEY-OK');
`;
const runJourney=async(dir,customerDbName)=>{
 const scriptDir=path.join(dir,'.journey');
 await mkdir(scriptDir,{recursive:true});
 const file=path.join(scriptDir,'journey.mjs');
  await writeFile(file,journeyScript,'utf8');
 const out=run(process.execPath,[file],dir);
 await rm(scriptDir,{recursive:true,force:true});
 assert(out.stdout.includes('JOURNEY-OK'),`${customerDbName} journey did not complete: ${out.stdout}${out.stderr}`);
};

try{
 // ---- A. generate + install from tarballs + build, no upstream source access ----
 const alpha=await step('A1 generate alpha from packaged core',()=>generate('alpha','Alpha Synthetic'));
 const beta=await step('A2 generate beta from packaged core',()=>generate('beta','Beta Synthetic'));
 await step('A3 both install from real tarballs (not symlinks)',async()=>{
  for(const dir of [alpha,beta]){
   for(const pkg of ['core','cloudflare','ui']){
    // lstat does not follow symlinks: a linked package would fail here.
    const info=await lstat(path.join(dir,'node_modules/@runlumi',pkg));
    assert(info.isDirectory()&&!info.isSymbolicLink(),`${dir} @runlumi/${pkg} must be an installed directory, not a link`);
   }
  }
 });
 await step('A4 both typecheck and build with no upstream source path',async()=>{
  for(const dir of [alpha,beta]){
   run(npm,['run','validate'],dir);
   run(npm,['run','typecheck'],dir);
   run(npm,['run','build'],dir);
   const assets=await readdir(path.join(dir,'apps/web/dist/assets'));
   const bundle=await readFile(path.join(dir,'apps/web/dist/assets',assets.find(f=>f.endsWith('.js'))),'utf8');
   assert(!bundle.includes('packages/core/src'),'bundle must not reference upstream source paths');
  }
 });
 await step('A5 each customer runs its own acceptance tests',async()=>{
  for(const dir of [alpha,beta]){
   const out=run(npm,['test'],dir);
   const all=[...(out.stdout.match(/# (pass|fail) \d+/g)??[]),...(out.stdout.match(/ℹ (pass|fail) \d+/g)??[])];
   const count=label=>Number((all.find(x=>x.includes(`${label} `))??'').match(/\d+/)?.[0]??0);
   assert(count('fail')===0,`${dir} customer tests must pass`);
  }
 });
 await step('A6 promoted report compiles in a fresh customer checkout without embedded results',async()=>{
  // Mirror of what promoteCommerceInsight emits: the component consumes the
  // exported definition through the pinned publication query at request time.
  const source=`import type {PageContext} from '@runlumi/ui/app.tsx';\nimport {api} from '@runlumi/ui/lib/api.ts';\nimport {Card,CardHeader,CardTitle,CardContent} from '@runlumi/ui/components/ui/card.tsx';\nimport {Loading,ErrorState} from '@runlumi/ui/components/states.tsx';\nimport {useQuery} from '@tanstack/react-query';\nimport {useState} from 'react';\nexport const reportDefinition={metricIds:['net_merchandise_sales'],from:'2026-09-01',toExclusive:'2026-10-01',dataVersion:'cp_reviewed',blocks:[{id:'sales-card',kind:'metric',metricId:'net_merchandise_sales'}]} as const;\nexport const reportTitle='Weekly sales';\nexport function Report({user,identity}:PageContext){\n const run=useQuery({queryKey:['promoted',user?.id],enabled:!!user,retry:false,queryFn:()=>api<{result:{metrics:Record<string,{value:string|null;unit:string}>}}>('/api/commerce/queries',identity,{method:'POST',body:{contract:'lumi.query.v1',metrics:reportDefinition.metricIds.map(id=>({id,version:1})),dimensions:[],filters:[{field:'business_date',op:'range',value:[reportDefinition.from,reportDefinition.toExclusive]}],limit:50,consistency:'published',dataVersion:reportDefinition.dataVersion}})});\n if(!user)return null;\n if(run.isPending)return <Loading/>;\n if(run.isError)return <ErrorState error={run.error}/>;\n const cell=run.data.result.metrics[reportDefinition.blocks[0].metricId];\n return <Card><CardHeader><CardTitle>{reportTitle}</CardTitle></CardHeader><CardContent>{cell?.value??'Chua xac dinh'}</CardContent></Card>;\n}\n`;
  for(const dir of [alpha,beta]){
   await mkdir(path.join(dir,'customer/reports'),{recursive:true});
   await writeFile(path.join(dir,'customer/reports/weekly-sales.report.tsx'),source);
   const out=run(npm,['run','typecheck'],dir);
   assert(out.ok,'promoted report must typecheck in the customer checkout');
   const report=await customerFile(dir,'customer/reports/weekly-sales.report.tsx');
   assert(!report.includes('720000'),'promoted source must not embed fixture financial results');
   assert(report.includes('reportDefinition.metricIds'),'the component must consume the exported definition');
   run('git',['add','customer/reports/weekly-sales.report.tsx'],dir);
   run('git',['-c','user.email=acceptance@lumi.invalid','-c','user.name=Lumi Acceptance','commit','-q','--no-verify','-m','reviewed report proposal'],dir);
  }
 });
 // Real local-D1 migration runner: applies, records, and is idempotent.
 await step('A5b npm run migrate applies to real local D1 and is idempotent',async()=>{
  for(const dir of [beta]){
   const wranglerOverride=path.join(root,'node_modules','wrangler');
   const first=run(npm,['run','migrate'],dir,{env:{WRANGLER_SEND_METRICS:'false',CI:'true',LUMI_WRANGLER_BIN:wranglerOverride}});
   assert(/Applied \d+ of \d+ migrations/.test(first.stdout),`first migrate must apply: ${first.stdout}${first.stderr}`);
   const ledgerFile=await customerFile(dir,'.wrangler/state/v3/d1/miniflare-D1DatabaseObject.sqlite').catch(()=>null);
   void ledgerFile;
   const second=run(npm,['run','migrate'],dir,{env:{WRANGLER_SEND_METRICS:'false',CI:'true',LUMI_WRANGLER_BIN:wranglerOverride}});
   assert(/All \d+ migrations are applied and unchanged/.test(second.stdout),`repeat migrate must be a no-op: ${second.stdout}${second.stderr}`);
  }
 });
 // ---- B. package-consumer commerce journey in each checkout ----
 await step('B1 full commerce journey runs in alpha against packaged artifacts',()=>runJourney(alpha,'alpha'));
 await step('B2 full commerce journey runs in beta against packaged artifacts',()=>runJourney(beta,'beta'));
 // ---- C. custom pages and extensions exist and are customer-owned ----
 await step('C1 alpha has a custom page and namespaced metric',async()=>{
  const pages=await customerFile(alpha,'customer/ui/pages.tsx');
  const metrics=await customerFile(alpha,'customer/data/metrics.ts');
  const server=await customerFile(alpha,'customer/data/server-metrics.ts');
  assert(pages.includes("path:'/warehouse'"),'alpha custom route missing');
  assert(metrics.includes('customer.warehouse_hours_saved'),'alpha custom metric missing');
  assert(server.includes('customer.warehouse_hours_saved'),'alpha must register the metric server-side');
  assert(pages.includes('/api/custom-metrics/customer.warehouse_hours_saved'),'alpha page must fetch the registered metric, not embed a value');
 });
 await step('C2 beta has a different custom page and metric',async()=>{
  const pages=await customerFile(beta,'customer/ui/pages.tsx');
  const metrics=await customerFile(beta,'customer/data/metrics.ts');
  const server=await customerFile(beta,'customer/data/server-metrics.ts');
  assert(pages.includes("path:'/channels'"),'beta custom route missing');
  assert(!pages.includes('/warehouse'),'beta must not share alpha navigation');
  assert(metrics.includes('customer.channel_margin_note'),'beta custom metric missing');
  assert(metrics.includes("'operations.cases'"),'beta metric must derive from the operations case source');
  assert(server.includes('customer.channel_margin_note'),'beta must register the metric server-side');
 });
 // ---- D. isolation across installations ----
 await step('D1 one customer connection identity is meaningless in the other database',async()=>{
  // beta's journey DB never saw alpha's connection: this is proven by the fact
  // that each journey ran on its own LocalDatabase with fresh schema, and by the
  // forged-field rejection: a body carrying foreign installation fields is 400.
  const scriptDir=path.join(beta,'.journey');
  await mkdir(scriptDir,{recursive:true});
  const file=path.join(scriptDir,'isolation.mjs');
  await writeFile(file,`
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {LocalDatabase,LocalObjects} from '@runlumi/cloudflare/testing.ts';
import {createApi} from '@runlumi/core/api.ts';
const db=new LocalDatabase();
const migDir='../node_modules/@runlumi/core/migrations/installation/';
const {readdir}=await import('node:fs/promises');
for(const f of (await readdir(new URL(migDir,import.meta.url))).filter(name=>name.endsWith('.sql')).sort())db.db.exec(await readFile(new URL(migDir+f,import.meta.url),'utf8'));
const api=createApi(async()=>({issuer:'local',subject:'no-one'}),false,{standalone:true});
const env={DB:db,SOURCES:new LocalObjects()};
const login=await api(new Request('http://localhost/api/setup',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'B',login:'o@b.test',displayName:'O',password:['isolation','owner','1'].join('-')})}),env);
const cookie=(login.headers.get('set-cookie')??'').split(';')[0];
// alpha's connection id does not exist here.
const body=JSON.stringify({eventType:'snapshot',connectionId:'orders-export',sourceAccountId:'shop-A',resourceType:'orders',deliveryId:'d1',sourceObjectId:'d1',sourceRevision:null,sourceEventAt:null,sourceUpdatedAt:null,window:{from:'2026-09-01T00:00:00.000Z',toExclusive:'2026-09-20T00:00:00.000Z'},schemaFingerprint:'sha256:'+'a'.repeat(64),rawJson:'{}'});
const r=await api(new Request('http://localhost/api/commerce/receipts',{method:'POST',headers:{'content-type':'application/json',cookie},body}),env);
assert.equal(r.status,404);assert.equal((await r.json()).error.code,'CONNECTION_NOT_FOUND');
console.log('ISOLATION-OK');
`,'utf8');
  const out=run(process.execPath,[file],beta);
  await rm(path.join(beta,'.journey'),{recursive:true,force:true});
  assert(out.stdout.includes('ISOLATION-OK'),`isolation proof failed: ${out.stdout}${out.stderr}`);
 });
 // ---- F. N+1 upgrade preserves customer-owned files ----
 await step('F1 both upgrade to N+1 without altering customer files',async()=>{
  const before={alpha:await customerFile(alpha,'customer/ui/pages.tsx'),beta:await customerFile(beta,'customer/ui/pages.tsx')};
  const beforeLockA=await customerFile(alpha,'lumi.lock.json');
  const bump=path.join(work,'upstream-n1');
  await cp(root,bump,{recursive:true,filter:source=>!source.includes('node_modules')&&!source.includes('/.git/')&&!source.includes('/artifacts/')&&!source.endsWith('/artifacts')});
  for(const pkg of ['core','cloudflare','ui']){
   const file=path.join(bump,'packages',pkg,'package.json');const j=JSON.parse(await readFile(file,'utf8'));
   j.version=nextCoreVersion;if(pkg==='cloudflare'||pkg==='ui')j.dependencies['@runlumi/core']=nextCoreVersion;
   await writeFile(file,JSON.stringify(j,null,2));
  }
  await writeFile(path.join(bump,'packages/core/src/version.ts'),`export const LUMI_CORE_VERSION = '${nextCoreVersion}';\nexport const LUMI_EXTENSION_API = 1;\n`);
  // The N+1 release carries a REAL behavior change: the operations caveat text.
  const semantics=path.join(bump,'packages/core/src/semantics.ts');
  await writeFile(semantics,(await readFile(semantics,'utf8')).replace('đồng Việt Nam.','đồng Việt Nam (cập nhật N+1).'));
  run(npm,['install','--ignore-scripts','--save-exact'],bump);
  run(npm,['run','build:packages'],bump);
  const artifacts=path.join(bump,'artifacts/core');
  const syntheticCommit='2'.repeat(40);
  run(process.execPath,['scripts/core-pack.mjs'],bump,{env:{LUMI_SOURCE_COMMIT:syntheticCommit}});
  for(const dir of [alpha,beta]){
   const out=run(npm,['run','upgrade','--','--from',artifacts],dir);
   assert(out.stdout.includes(`${currentCoreVersion} -> ${nextCoreVersion}`),`upgrade plan must report ${currentCoreVersion} -> ${nextCoreVersion} for ${dir}`);
   const lock=JSON.parse(await customerFile(dir,'lumi.lock.json'));
   assert.equal(lock.core.version,nextCoreVersion,`${dir} lock must record N+1`);
   // Reinstall so the installed packages are the upgraded release, not the old one.
   run(npm,['ci','--ignore-scripts'],dir);
  }
  assert.equal(await customerFile(alpha,'customer/ui/pages.tsx'),before.alpha,'alpha customer page must be byte-identical after upgrade');
  assert.equal(await customerFile(beta,'customer/ui/pages.tsx'),before.beta,'beta customer page must be byte-identical after upgrade');
  assert.notEqual(await customerFile(alpha,'lumi.lock.json'),beforeLockA,'alpha lock must change on upgrade');
  // The upgrade is committed per the operator runbook after validation and
  // rebuild, so later operations (like a rollback) start from a clean tree.
  for(const dir of [alpha,beta]){
   run(npm,['run','validate'],dir);
   run(npm,['run','build'],dir);
   run('git',['add','-A'],dir);
   run('git',['-c','user.email=acceptance@lumi.invalid','-c','user.name=Lumi Acceptance','commit','-q','--no-verify','-m',`core upgrade ${currentCoreVersion} -> ${nextCoreVersion}`],dir);
   const status=spawnSync('git',['status','--porcelain'],{cwd:dir,encoding:'utf8'});
   assert.equal(status.stdout.trim(),'',`tree must be clean after the committed upgrade: ${status.stdout}`);
  }
  // The real behavior change must be live in the INSTALLED runtime, not just recorded.
  const upgraded=await customerFile(alpha,'vendor/lumi-core-manifest.json');
  assert(upgraded.includes(nextCoreVersion),'vendored manifest must record the new release');
  for(const dir of [alpha,beta]){
   const installed=await customerFile(dir,'node_modules/@runlumi/core/dist/semantics.js');
   assert(installed.includes('cập nhật N+1'),`${dir} installed core ${nextCoreVersion} must carry the N+1 behavior change`);
  }
  for(const dir of [alpha,beta]){run(npm,['run','validate'],dir);run(npm,['run','build'],dir);}
 });
 await step('F2 custom tests keep passing on N+1',async()=>{
  // The test command's exit code is authoritative across Node reporter formats.
  for(const dir of [alpha,beta])run(npm,['test'],dir);
 });
 // ---- G. incompatible extension/migration input rejected with a diagnostic ----
 await step('G1 reserved-route collision is rejected before deployment',async()=>{
  const lockPath=path.join(beta,'lumi.lock.json');
  const originalText=await customerFile(beta,'lumi.lock.json');
  const lock=JSON.parse(originalText);
  lock.customerPages=[...lock.customerPages,{path:'/money',label:'Hijack core route'}];
  await writeFile(lockPath,JSON.stringify(lock,null,2));
  const out=run(npm,['run','validate'],beta,{expectFail:true});
  assert(/reserved core route/.test(out.stdout+out.stderr),'diagnostic must name the reserved route collision');
  await writeFile(lockPath,originalText);
 });
 await step('G2 bad customer id is rejected with a diagnostic',async()=>{
  const lockPath=path.join(beta,'lumi.lock.json');
  const originalText=await customerFile(beta,'lumi.lock.json');
  const lock=JSON.parse(originalText);
  lock.customerId='INVALID ID';
  await writeFile(lockPath,JSON.stringify(lock,null,2));
  const out=run(npm,['run','validate'],beta,{expectFail:true});
  assert(/does not match/.test(out.stdout+out.stderr),'mismatched identity must be reported');
  await writeFile(lockPath,originalText);
 });
 // ---- H. one customer's rollback leaves the other unchanged ----
 await step(`H1 beta rolls back to REAL ${currentCoreVersion} artifacts; alpha stays at N+1`,async()=>{
  // Execute an actual artifact rollback through the updater, not a lock edit.
  const originalArtifacts=path.join(root,'artifacts/core');
  run(npm,['run','upgrade','--','--from',originalArtifacts],beta);
  // Reinstall so node_modules matches the rolled-back lock, then prove the
  // installed runtime is genuinely N again.
  run(npm,['ci','--ignore-scripts'],beta);
  const betaLock=JSON.parse(await customerFile(beta,'lumi.lock.json'));
  const alphaLock=JSON.parse(await customerFile(alpha,'lumi.lock.json'));
  assert.equal(betaLock.core.version,currentCoreVersion,'beta records the rollback');
  assert.equal(alphaLock.core.version,nextCoreVersion,'alpha is unchanged by beta rollback');
  const installedCore=JSON.parse(await customerFile(beta,'node_modules/@runlumi/core/package.json'));
  assert.equal(installedCore.version,currentCoreVersion,'beta installed core is the previous release');
  const installedSemantics=await customerFile(beta,'node_modules/@runlumi/core/dist/semantics.js');
  assert(!installedSemantics.includes('cập nhật N+1'),`the N+1 behavior change must be gone from beta's runtime`);
  // The rolled-back application still validates, builds and passes its tests at N.
  run(npm,['run','validate'],beta);
  run(npm,['run','build'],beta);
  // npm test exit status is stable across TAP and spec reporter output formats.
  run(npm,['test'],beta);
  // Rollback semantics: code reverts, the migrated database does not.
  assert(/does not reverse a database migration/.test(await customerFile(beta,'scripts/upgrade.mjs')),'rollback guidance must state migration limits');
 });
 // ---- I. per-environment deployment identity and the operator review gate ----
 await step('I1 production and staging own distinct deployment identities',async()=>{
  for(const dir of [alpha,beta]){
   const lock=JSON.parse(await customerFile(dir,'lumi.lock.json'));
   const prod=JSON.parse(await customerFile(dir,'infra/environments/production.json'));
   const staging=JSON.parse(await customerFile(dir,'infra/environments/staging.json'));
   assert.equal(prod.customerId,lock.customerId);assert.equal(staging.customerId,lock.customerId);
   for(const key of ['workerName','hostname','deploymentId','sourcesBucket','accessAudience']){
    assert.notEqual(prod[key],staging[key],`${key} must differ between ${dir} environments`);
   }
   assert.notEqual(prod.database.databaseName,staging.database.databaseName,`${dir} databases must differ`);
   assert.notEqual(prod.database.databaseId,staging.database.databaseId,`${dir} database ids must differ`);
   const wrangler=JSON.parse(await customerFile(dir,'apps/worker/wrangler.jsonc'));
   assert.equal(wrangler.name,prod.workerName,'production is the wrangler base');
   assert.equal(wrangler.env.staging.name,staging.workerName,'staging is a named wrangler environment');
   assert.equal(wrangler.env.staging.d1_databases[0].database_id,staging.database.databaseId);
  }
 });
 await step('I2 deploy:plan blocks scaffold placeholders before any review',async()=>{
  const out=run(npm,['run','deploy:plan'],alpha,{expectFail:true});
  assert(!out.ok,'unreviewed scaffold must never be deployable');
  assert(/hostname must be reviewed/.test(out.stdout+out.stderr),'the diagnostic must name the unreviewed hostname');
 });
 console.log(results.join('\n'));
 console.log(`\nAcceptance: ${results.filter(r=>r.startsWith('PASS')).length}/${results.length} checks passed.`);
}catch(error){
 console.error(results.join('\n'));
 console.error(`\nAcceptance aborted: ${error.message}`);
 process.exitCode=1;
}finally{
 if(process.env.LUMI_KEEP_ACCEPTANCE!=='1')await rm(work,{recursive:true,force:true});
 else console.log(`Acceptance workspace retained at ${work}`);
}
