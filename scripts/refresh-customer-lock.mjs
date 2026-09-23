#!/usr/bin/env node
/** Regenerate starter/customer/package-lock.json.template so it is consistent with
 * the exact @runlumi artifacts produced by `npm run core:pack`.
 *
 * The generated customer repository ships a complete, reviewed lockfile; generation
 * is a file copy with no registry resolution. Whenever the coordinated core release
 * changes (version bump or package set change), this script must be re-run and its
 * diff reviewed before generation produces a graph that can run `npm ci`.
 *
 * Uses the configured npm release-age policy without overriding it. The emitted lock
 * is exact and immutable for consumers; determinism lives in the committed file,
 * while newly resolved transitive packages still respect the repository's admission window. */
import {mkdtemp, cp, readFile, writeFile, readdir, rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const starter=path.join(root,'starter/customer');
const artifacts=path.join(root,'artifacts/core');

const manifest=JSON.parse(await readFile(path.join(artifacts,'lumi-core-manifest.json'),'utf8').catch(()=>{throw new Error('Core artifacts missing. Run: npm run core:pack');}));
const dummy=process.env.LUMI_LOCK_CUSTOMER??'lockrefresh';
if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(dummy))throw new Error('Invalid dummy customer id');

const work=await mkdtemp(path.join(tmpdir(),'lumi-lock-refresh-'));
try{
 const scratch=path.join(work,'customer');
 await cp(starter,scratch,{recursive:true,filter:source=>!source.includes('node_modules')&&!source.includes('/.git/')});
 const pkgPath=path.join(scratch,'package.json.template');
 const pkgTemplate=await readFile(pkgPath,'utf8');
 const pkg=pkgTemplate
  .replaceAll('__CUSTOMER_ID__',dummy)
  .replaceAll('__DISPLAY_NAME__',dummy)
  .replaceAll('__DEPLOYMENT_ID__',`${dummy}-production`)
  .replaceAll('__ENVIRONMENT__','production')
  .replaceAll('__TEMPLATE_VERSION__',String(manifest.templateVersion))
  .replaceAll('__SOURCE_COMMIT__',manifest.sourceCommit)
  .replaceAll('__RELEASE_DIGEST__','lock-refresh')
  .replaceAll('__CORE_SHA256__',manifest.packages['@runlumi/core'].sha256)
  .replaceAll('__CLOUDFLARE_SHA256__',manifest.packages['@runlumi/cloudflare'].sha256)
  .replaceAll('__UI_SHA256__',manifest.packages['@runlumi/ui'].sha256)
  .replaceAll('__CORE_TARBALL__',`file:vendor/${manifest.packages['@runlumi/core'].file}`)
  .replaceAll('__CLOUDFLARE_TARBALL__',`file:vendor/${manifest.packages['@runlumi/cloudflare'].file}`)
  .replaceAll('__UI_TARBALL__',`file:vendor/${manifest.packages['@runlumi/ui'].file}`)
  .replaceAll('__HOSTNAME__',`${dummy}.bi.runlumi.app`)
  .replaceAll('__ACCESS_TEAM__','replace-access-team')
  .replaceAll('__ACCESS_AUD__','a'.repeat(32))
  .replaceAll('__CONTROL_WORKER__','lumi-control')
  .replaceAll('__DATABASE_NAME__',`${dummy}-serving`)
  .replaceAll('__DATABASE_ID__','00000000-0000-0000-0000-000000000000')
  .replaceAll('__SOURCES_BUCKET__',`${dummy}-sources`);
 const remaining=/__[A-Z][A-Z0-9_]*__/.exec(pkg);
 if(remaining)throw new Error(`Unsubstituted template token ${remaining[0]} in package.json.template`);
 await writeFile(path.join(scratch,'package.json'),pkg);
 await rm(path.join(scratch,'package.json.template'),{force:true});
 // Vendor the exact artifacts, then resolve the graph once with an explicit future
 // cutoff (see header note). No lifecycle scripts run; no audit is performed here.
 await cp(path.join(artifacts,'lumi-core-manifest.json'),path.join(scratch,'vendor','lumi-core-manifest.json'));
 for(const info of Object.values(manifest.packages))await cp(path.join(artifacts,info.file),path.join(scratch,'vendor',info.file));
 const npmCommand=process.env.LUMI_NPM_BIN??'npm';
 const npmArgs=['install','--package-lock-only','--ignore-scripts','--no-audit','--no-fund'];
 const r=process.env.npm_execpath
  ? spawnSync(process.env.npm_node_execpath??process.execPath,[process.env.npm_execpath,...npmArgs],{cwd:scratch,stdio:'inherit'})
  : spawnSync(npmCommand,npmArgs,{cwd:scratch,stdio:'inherit'});
 if(r.status!==0)throw new Error('Could not resolve the reviewed customer dependency graph; no template lock was written.');

 // Verify the resolved lock against the exact artifacts before adopting it.
 const lock=JSON.parse(await readFile(path.join(scratch,'package-lock.json'),'utf8'));
 if(lock.lockfileVersion!==3)throw new Error('Template lock must be lockfileVersion 3');
 const rootPkg=lock.packages[''];
 if(rootPkg.name!==`${dummy}-lumi-app`)throw new Error(`Unexpected lock root name ${rootPkg.name}`);
 for(const[name,info]of Object.entries(manifest.packages)){
  const spec=`file:vendor/${info.file}`;
  if(rootPkg.dependencies?.[name]!==spec)throw new Error(`Template lock dependency ${name} is ${rootPkg.dependencies?.[name]}, expected ${spec}`);
  const entry=lock.packages[`node_modules/${name}`];
  if(entry?.version!==info.version||entry?.resolved!==spec)throw new Error(`Template lock entry for ${name} is out of sync with the release`);
  if(!/^sha512-/.test(entry?.integrity??''))throw new Error(`Template lock entry for ${name} lacks sha512 integrity`);
 }
 const registryMissing=Object.entries(lock.packages).filter(([k,p])=>k&&p.resolved?.startsWith('https://')&&!/^sha512-/.test(p.integrity??''));
 if(registryMissing.length)throw new Error(`Registry entries without integrity in template lock: ${registryMissing.length}`);
 // Adopt the lock: change the dummy customer name back to the template token.
 lock.name='__CUSTOMER_ID__-lumi-app';
 rootPkg.name='__CUSTOMER_ID__-lumi-app';
 await writeFile(path.join(root,'starter','customer','package-lock.json.template'),JSON.stringify(lock,null,2)+'\n');
 console.log(`Refreshed starter/customer/package-lock.json.template for core ${manifest.release} (${Object.keys(lock.packages).length} locked packages). Review the diff and commit.`);
}finally{
 await rm(work,{recursive:true,force:true});
}
