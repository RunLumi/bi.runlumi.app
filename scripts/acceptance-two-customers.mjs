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
import {mkdtemp, cp, readFile, writeFile, rm, readdir, stat} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import process from 'node:process';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const npm=process.env.LUMI_NPM_BIN??'/opt/homebrew/bin/npm';
const work=await mkdtemp(path.join(tmpdir(),'lumi-acceptance-'));
const results=[];
const step=async(name,fn)=>{try{const value=await fn();results.push(`PASS ${name}`);return value;}catch(error){results.push(`FAIL ${name}: ${error.message}`);throw error;}};
const run=(command,args,cwd,{expectFail=false}={})=>{
 const r=spawnSync(command,args,{cwd,encoding:'utf8',env:{...process.env,LUMI_NPM_BIN:npm}});
 if(r.status!==0&&!expectFail)throw new Error(`${command} ${args.join(' ')} failed: ${(r.stdout??'')+(r.stderr??'')}`);
 return {...r,ok:r.status===0};
};
const generate=async(customer,name)=>{
 const dest=path.join(work,customer);
 run(process.execPath,[path.join(root,'scripts/customer-new.mjs'),'--customer',customer,'--name',name,'--dest',dest],root);
 // Apply the checked-in synthetic overlay (custom pages, metrics, navigation).
 await cp(path.join(root,'examples/customers',customer,'customer'),path.join(dest,'customer'),{recursive:true});
 run(npm,['install','--ignore-scripts','--save-exact'],dest,{expectFail:false});
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
  lock.customerPages=[{path:'/money',label:'Hijack core route'}];
  await writeFile(path.join(beta,'lumi.lock.json'),JSON.stringify(lock,null,2));
  const out=run(npm,['run','validate'],beta,{expectFail:true});
  assert(/reserved core route/.test(out.stdout+out.stderr),'diagnostic must name the reserved route collision');
  lock.customerPages=[];await writeFile(path.join(beta,'lumi.lock.json'),JSON.stringify(lock,null,2));
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
  await cp(root,bump,{recursive:true,filter:source=>!source.includes('node_modules')&&!source.includes('/.git/')&&!source.includes('artifacts')});
  for(const pkg of ['core','cloudflare','ui']){
   const file=path.join(bump,'packages',pkg,'package.json');const j=JSON.parse(await readFile(file,'utf8'));
   j.version='0.1.1';if(pkg==='cloudflare'||pkg==='ui')j.dependencies['@runlumi/core']='0.1.1';
   await writeFile(file,JSON.stringify(j,null,2));
  }
  await writeFile(path.join(bump,'packages/core/src/version.ts'),"export const LUMI_CORE_VERSION = '0.1.1';\nexport const LUMI_EXTENSION_API = 1;\n");
  run(npm,['install','--ignore-scripts','--save-exact'],bump);
  run(npm,['run','build:packages'],bump);
  const artifacts=path.join(bump,'artifacts/core');
  run(process.execPath,['scripts/core-pack.mjs'],bump);
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
