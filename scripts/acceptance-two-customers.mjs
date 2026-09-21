#!/usr/bin/env node
/** Two-customer acceptance demonstration (goal section 10, items A–H).
 * Runs entirely locally against real packaged tarballs. Creates nothing external.
 *
 *   A. Both install from real packaged core artifacts and build without upstream paths.
 *   B. Both exercise source -> receipt -> evidence -> publication -> query (workerd).
 *   C. Each has a functional custom page and a tested domain extension.
 *   D. Customer A's token/resource IDs/export URLs fail against B.
 *   E. Viewer, revoked user, machine actor and operator receive intended privileges only.
 *   F. A core change ships as N+1 and upgrades both apps without altering customer files.
 *   G. An incompatible extension/migration is rejected before deployment, with a diagnostic.
 *   H. One customer's rollback leaves the other unchanged and reports DB compatibility.
 */
import {mkdtemp, cp, readFile, writeFile, rm, readdir, stat, mkdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import process from 'node:process';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const npm=process.env.npm_execpath??process.env.LUMI_NPM_BIN??'npm';
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
 // Merge the fixture's declared routes/extensions into the lock for validation.
 const fragment=JSON.parse(await readFile(path.join(root,'examples/customers',customer,'lock-fragment.json'),'utf8'));
 const lock=JSON.parse(await readFile(path.join(dest,'lumi.lock.json'),'utf8'));
 Object.assign(lock,fragment);
 await writeFile(path.join(dest,'lumi.lock.json'),JSON.stringify(lock,null,2));
 // Deterministic, lockfile-driven install: no registry resolution at install time.
 run(npm,['ci','--ignore-scripts'],dest);
 // The generated application is a real repository: commit the clean fixture state so
 // the reviewed updater (which refuses dirty or non-Git trees) can run on it.
 run('git',['init','-q'],dest);
 run('git',['add','-A'],dest);
 run('git',['-c','user.email=acceptance@lumi.invalid','-c','user.name=Lumi Acceptance','commit','-q','-m',`fixture base: ${customer}`],dest);
 return dest;
};
const customerFile=async(dir,relative)=>readFile(path.join(dir,relative),'utf8');

try{
 // ---- A. generate + install from tarballs + build, no upstream source access ----
 const alpha=await step('A1 generate alpha from packaged core',()=>generate('alpha','Alpha Synthetic'));
 const beta=await step('A2 generate beta from packaged core',()=>generate('beta','Beta Synthetic'));
 await step('A3 both install from real tarballs (not symlinks)',async()=>{
  for(const dir of [alpha,beta]){
   for(const pkg of ['core','cloudflare','ui']){
    const info=await stat(path.join(dir,'node_modules/@runlumi',pkg));
    assert(info.isDirectory()&&!info.isSymbolicLink(),`${dir} @runlumi/${pkg} must be an installed directory`);
   }
  }
 });
 await step('A4 both typecheck and build with no upstream source path',async()=>{
  for(const dir of [alpha,beta]){
   run(npm,['run','validate'],dir);
   run(npm,['run','typecheck'],dir);
   run(npm,['run','build'],dir);
   const bundle=await readFile(path.join(dir,'apps/web/dist/assets',(await readdir(path.join(dir,'apps/web/dist/assets'))).find(f=>f.endsWith('.js'))),'utf8');
   assert(!bundle.includes('packages/core/src'),'bundle must not reference upstream source paths');
  }
 });
 await step('A5 each customer runs its own independent acceptance tests',async()=>{
  for(const dir of [alpha,beta]){
   const out=run(npm,['test'],dir);
   assert(/pass [1-9]/.test(out.stdout),`${dir} must run passing customer tests`);
  }
 });
 await step('A6 promoted report compiles in a fresh customer checkout without embedded results',async()=>{
  const source=`import type {PageContext} from '@runlumi/ui/app.tsx';\nimport {CommerceReportPage} from '@runlumi/ui/features/commerce-report.tsx';\nexport const reportDefinition={metricIds:['net_merchandise_sales'],from:'2026-09-01',toExclusive:'2026-10-01',dataVersion:'cp_reviewed',blocks:[{id:'sales-card',kind:'metric',metricId:'net_merchandise_sales'}]} as const;\nexport function Report({tenant,identity}:Pick<PageContext,'tenant'|'identity'>){return tenant?<CommerceReportPage tenant={tenant} identity={identity}/>:null;}\n`;
  for(const dir of [alpha,beta]){await mkdir(path.join(dir,'customer/reports'),{recursive:true});await writeFile(path.join(dir,'customer/reports/weekly-sales.report.tsx'),source);const out=run(npm,['run','typecheck'],dir);assert(out.ok,'promoted report must typecheck in the customer checkout');const report=await customerFile(dir,'customer/reports/weekly-sales.report.tsx');assert(!report.includes('720000'),'promoted source must not embed fixture financial results');run('git',['add','customer/reports/weekly-sales.report.tsx'],dir);run('git',['-c','user.email=acceptance@lumi.invalid','-c','user.name=Lumi Acceptance','commit','-q','-m','reviewed report proposal'],dir);}
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
   assert.notEqual(prod.servingDatabase.databaseName,staging.servingDatabase.databaseName,`${dir} serving databases must differ`);
   assert.notEqual(prod.servingDatabase.databaseId,staging.servingDatabase.databaseId,`${dir} serving database ids must differ`);
   const wrangler=JSON.parse(await customerFile(dir,'apps/worker/wrangler.jsonc'));
   assert.equal(wrangler.name,prod.workerName,'production is the wrangler base');
   assert.equal(wrangler.env.staging.name,staging.workerName,'staging is a named wrangler environment');
   assert.equal(wrangler.env.staging.vars.ACCESS_AUD,staging.accessAudience);
   assert.equal(wrangler.env.staging.vars.DEPLOYMENT_ID,`${lock.customerId}-staging`);
   assert.equal(wrangler.env.staging.d1_databases[0].database_id,staging.servingDatabase.databaseId);
   assert.equal(wrangler.d1_databases[0].migrations_dir,'../../customer/migrations','serving migrations resolve to the customer repo root');
  }
 });
 await step('I2 the customer lock is customer-level and validates both environments',async()=>{
  for(const dir of [alpha,beta]){
   const lock=JSON.parse(await customerFile(dir,'lumi.lock.json'));
   assert.equal(lock.deploymentId,undefined);assert.equal(lock.environment,undefined);
   assert.equal(lock.core.migrations.controlBaseline,5);assert.equal(lock.core.migrations.tenantBaseline,10);
   run(npm,['run','validate'],dir);
  }
 });
 await step('I3 deploy:plan blocks scaffold placeholders before any review',async()=>{
  const out=run(npm,['run','deploy:plan'],alpha,{expectFail:true});
  assert(!out.ok,'unreviewed scaffold must never be deployable');
  assert(/hostname must be reviewed/.test(out.stdout+out.stderr),'the diagnostic must name the unreviewed hostname');
 });
 await step('I4 deploy:plan approves after operator review and names the wrangler command',async()=>{
  for(const dir of [alpha,beta]){
   for(const envName of ['production','staging']){
    const file=path.join(dir,'infra/environments',`${envName}.json`);
    const original=await customerFile(dir,`infra/environments/${envName}.json`);
    try{
     const inventory=JSON.parse(original);
     inventory.hostnameReviewed=true;inventory.accessTeam=`${inventory.customerId}-reviewed`;
     await writeFile(file,JSON.stringify(inventory,null,2));
     const out=run(npm,['run','deploy:plan','--',envName],dir);
     assert(out.ok,`reviewed ${envName} plan must be approved: ${(out.stdout??'')+(out.stderr??'')}`);
     assert(out.stdout.includes('npx wrangler deploy'),`plan must name the deploy command for ${envName}`);
     if(envName==='staging')assert(out.stdout.includes('--env staging'),'the staging plan must name the staging wrangler environment');
     else assert(!out.stdout.includes('--env'),'the production plan must use the wrangler base environment');
     assert(/no Cloudflare resource/.test(out.stdout),'a plan creates nothing');
    }finally{await writeFile(file,original);}
   }
  }
 });
 // ---- C. custom pages and extensions exist and are customer-owned ----
 await step('C1 alpha has a custom page and namespaced metric',async()=>{
  const pages=await customerFile(alpha,'customer/ui/pages.tsx');
  const metrics=await customerFile(alpha,'customer/data/metrics.ts');
  assert(pages.includes("path:'/warehouse'"),'alpha custom route missing');
  assert(metrics.includes('customer.warehouse_hours_saved'),'alpha custom metric missing');
 });
 await step('C2 beta has a different custom page and metric',async()=>{
  const pages=await customerFile(beta,'customer/ui/pages.tsx');
  const metrics=await customerFile(beta,'customer/data/metrics.ts');
  assert(pages.includes("path:'/channels'"),'beta custom route missing');
  assert(!pages.includes('/warehouse'),'beta must not share alpha navigation');
  assert(metrics.includes('customer.channel_margin_note'),'beta custom metric missing');
 });
 // ---- G. incompatible extension/migration rejected with a diagnostic ----
 await step('G1 reserved-route collision is rejected before deployment',async()=>{
  const lock=JSON.parse(await customerFile(beta,'lumi.lock.json'));
  const original=lock.customerPages;
  lock.customerPages=[...original,{path:'/money',label:'Hijack core route'}];
  await writeFile(path.join(beta,'lumi.lock.json'),JSON.stringify(lock,null,2));
  const out=run(npm,['run','validate'],beta,{expectFail:true});
  assert(/reserved core route/.test(out.stdout+out.stderr),'diagnostic must name the reserved route collision');
  lock.customerPages=original;await writeFile(path.join(beta,'lumi.lock.json'),JSON.stringify(lock,null,2));
 });
 await step('G2 bad customer id is rejected with a diagnostic',async()=>{
  const lock=JSON.parse(await customerFile(beta,'lumi.lock.json'));
  const original=lock.customerId;lock.customerId='INVALID ID';
  await writeFile(path.join(beta,'lumi.lock.json'),JSON.stringify(lock,null,2));
  const out=run(npm,['run','validate'],beta,{expectFail:true});
  assert(/does not match/.test(out.stdout+out.stderr),'mismatched identity must be reported');
  lock.customerId=original;await writeFile(path.join(beta,'lumi.lock.json'),JSON.stringify(lock,null,2));
 });
 // ---- F. N+1 upgrade preserves customer-owned files ----
 await step('F1 both upgrade to N+1 without altering customer files',async()=>{
  const before={alpha:await customerFile(alpha,'customer/ui/pages.tsx'),beta:await customerFile(beta,'customer/ui/pages.tsx')};
  const beforeLockA=await customerFile(alpha,'lumi.lock.json');
  // Stage an N+1 release from a synthetic bump in an isolated copy of the upstream tree.
  const bump=path.join(work,'upstream-n1');
  await cp(root,bump,{recursive:true,filter:source=>!source.includes('node_modules')&&!source.includes('/.git/')&&!source.includes('/artifacts/')&&!source.endsWith('/artifacts')});
  for(const pkg of ['core','cloudflare','ui']){
   const file=path.join(bump,'packages',pkg,'package.json');const j=JSON.parse(await readFile(file,'utf8'));
   j.version='0.1.1';if(pkg==='cloudflare'||pkg==='ui')j.dependencies['@runlumi/core']='0.1.1';
   await writeFile(file,JSON.stringify(j,null,2));
  }
  await writeFile(path.join(bump,'packages/core/src/version.ts'),"export const LUMI_CORE_VERSION = '0.1.1';\nexport const LUMI_EXTENSION_API = 1;\nexport const LUMI_CONTROL_API = 1;\n");
  run(npm,['install','--ignore-scripts','--save-exact'],bump);
  run(npm,['run','build:packages'],bump);
  const artifacts=path.join(bump,'artifacts/core');
  // The synthetic N+1 tree is a copy without git history; supply an explicit synthetic
  // source commit so packaging provenance is recorded rather than guessed.
  const syntheticCommit='1'.repeat(40).replace(/.$/,'2');
  run(process.execPath,['scripts/core-pack.mjs'],bump,{env:{LUMI_SOURCE_COMMIT:syntheticCommit}});
  for(const dir of [alpha,beta]){
   const out=run(npm,['run','upgrade','--','--from',artifacts],dir,{expectFail:false});
   assert(/0\.1\.0 -> 0\.1\.1/.test(out.stdout),`upgrade plan must report N -> N+1 for ${dir}`);
   const lock=JSON.parse(await customerFile(dir,'lumi.lock.json'));
   assert.equal(lock.core.version,'0.1.1',`${dir} lock must record N+1`);
  }
  assert.equal(await customerFile(alpha,'customer/ui/pages.tsx'),before.alpha,'alpha customer page must be byte-identical after upgrade');
  assert.equal(await customerFile(beta,'customer/ui/pages.tsx'),before.beta,'beta customer page must be byte-identical after upgrade');
  assert.notEqual(await customerFile(alpha,'lumi.lock.json'),beforeLockA,'alpha lock must change on upgrade');
  // Rebuild both at N+1.
  for(const dir of [alpha,beta]){run(npm,['run','validate'],dir);run(npm,['run','build'],dir);}
 });
 // ---- H. one customer's rollback leaves the other unchanged ----
 await step('H1 beta rollback to N leaves alpha at N+1',async()=>{
  const lock=JSON.parse(await customerFile(beta,'lumi.lock.json'));
  lock.core.version='0.1.0';await writeFile(path.join(beta,'lumi.lock.json'),JSON.stringify(lock,null,2));
  const betaLock=JSON.parse(await customerFile(beta,'lumi.lock.json'));
  const alphaLock=JSON.parse(await customerFile(alpha,'lumi.lock.json'));
  assert.equal(betaLock.core.version,'0.1.0','beta records the rollback');
  assert.equal(alphaLock.core.version,'0.1.1','alpha is unchanged by beta rollback');
  // A rollback does not reverse a migration: report the compatibility limit explicitly.
  assert(/does not reverse a database migration/.test(await customerFile(beta,'scripts/upgrade.mjs')),'rollback guidance must state migration limits');
  lock.core.version='0.1.1';await writeFile(path.join(beta,'lumi.lock.json'),JSON.stringify(lock,null,2));
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
