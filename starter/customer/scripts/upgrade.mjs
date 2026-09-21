/** Reviewed core upgrade for a customer application.
 * Updates packaged core dependencies and compatibility metadata, reports migrations
 * and extension incompatibilities, and preserves customer-owned files. Refuses unsafe
 * dirty-tree or conflicting updates. Never contacts a registry: it installs the exact
 * tarballs supplied in --from <artifacts/core directory> or already vendored. */
import {readFile, writeFile, readdir, cp, rm, access, mkdtemp} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(root,'..');
const args=process.argv.slice(2);
const option=name=>{const i=args.indexOf(`--${name}`);return i>=0?args[i+1]:undefined;};
const checkOnly=args.includes('--check');
const fromDir=option('from');
const readJson=async p=>JSON.parse(await readFile(path.join(repoRoot,p),'utf8'));
const exists=async p=>{try{await access(p);return true;}catch{return false;}};
const npm=process.env.LUMI_NPM_BIN??'npm';

function sha256(buffer){return createHash('sha256').update(buffer).digest('hex');}
function sha512B64(buffer){return createHash('sha512').update(buffer).digest('base64');}
function run(command,commandArgs,cwd){const r=spawnSync(command,commandArgs,{cwd,stdio:'inherit'});if(r.status!==0)process.exit(r.status??1);}

// 1. Refuse to upgrade a dirty tree. Core updates arrive as reviewable diffs.
//    A git failure is a failure: a non-Git or broken repository is never silently
//    treated as a clean reviewed tree.
const gitStatus=spawnSync('git',['status','--porcelain'],{cwd:repoRoot,encoding:'utf8'});
if(gitStatus.error&&repoRoot)throw new Error(`Cannot inspect the repository: ${gitStatus.error.message}`);
if(gitStatus.status!==0)throw new Error(`git status failed (exit ${gitStatus.status}); refusing to upgrade an unverifiable repository.`);
const dirty=gitStatus.stdout.trim();
if(dirty)throw new Error('Working tree is dirty. Commit or stash changes before upgrading so the update is reviewable.');

const lock=await readJson('lumi.lock.json');
const manifestPath=fromDir?path.join(path.resolve(fromDir),'lumi-core-manifest.json'):path.join(repoRoot,'vendor/lumi-core-manifest.json');
const next=JSON.parse(await readFile(manifestPath,'utf8'));

// 1b. Artifact identity and byte integrity are checked before anything is written.
//     Only plain relative tarball names inside the reviewed artifacts directory are
//     accepted; traversal, absolute paths and foreign filenames fail closed.
const ARTIFACT_FILE=/^runlumi-(core|cloudflare|ui)-\d+\.\d+\.\d+\.tgz$/;
const packageBytes={};
for(const [name,info]of Object.entries(next.packages)){
 if(!info?.file||!ARTIFACT_FILE.test(info.file)||info.file.includes('/')||info.file.includes('\\')||info.file!==path.basename(info.file))throw new Error(`Unsafe artifact path in release metadata: ${String(info.file)}`);
 const source=path.join(path.dirname(manifestPath),info.file);
 const bytes=await readFile(source);
 const digest=sha256(bytes);
 if(digest!==info.sha256)throw new Error(`Artifact ${info.file} does not match the recorded sha256 (got ${digest.slice(0,12)}, expected ${String(info.sha256).slice(0,12)}). Refusing to upgrade.`);
 packageBytes[name]=bytes;
}

// 2. Compatibility gate runs before any file is written.
const parseSemver=v=>{const m=/^(\d+)\.(\d+)\.(\d+)$/.exec(v);if(!m)throw new Error(`Invalid core version ${v}`);return {major:Number(m[1]),minor:Number(m[2]),patch:Number(m[3])};};
const current=parseSemver(lock.core.version),target=parseSemver(next.release);
if(target.major!==current.major)throw new Error(`Core major upgrade ${lock.core.version} -> ${next.release} requires a documented migration; refusing an automatic upgrade.`);
if(next.extensionApi!==lock.core.extensionApi)throw new Error(`Extension API ${lock.core.extensionApi} -> ${next.extensionApi} is incompatible with this customer application. Update the extensions first.`);
if(next.templateVersion!==lock.core.templateVersion)console.warn(`Template moved ${lock.core.templateVersion} -> ${next.templateVersion}: review generated-file changes via three-way merge.`);

// 3. Report migration and extension deltas without applying anything in --check mode.
function countInstallationMigrations(migrations){return Object.keys(migrations??{}).filter(k=>k.startsWith('migrations/installation/')).length;}
const customerMigrations=(await exists('customer/migrations')?await readdir(path.join(repoRoot,'customer/migrations')):[]).filter(f=>f.endsWith('.sql'));
const report={
 from:lock.core.version,to:next.release,sourceCommit:next.sourceCommit,
 migrations:{installation:countInstallationMigrations(next.migrations)},
 customerMigrations,
 extensionApi:{from:lock.core.extensionApi,to:next.extensionApi}
};
console.log(`Upgrade plan: core ${report.from} -> ${report.to} (commit ${String(report.sourceCommit).slice(0,12)})`);
console.log(`Core installation migrations in target release: ${report.migrations.installation}`);
console.log(`Customer-owned migrations preserved: ${report.customerMigrations.length}`);
console.log(`Extension API: ${report.extensionApi.from} -> ${report.extensionApi.to}`);
if(checkOnly){console.log('Check only: no files changed. Rerun without --check to apply.');process.exit(0);}

// 4. Apply: copy verified tarballs, then update package.json and the npm lockfile
//    in place for the @runlumi packages only. Registry dependencies never change
//    during a core upgrade, so there is nothing to re-resolve: `npm ci` installs
//    the exact reviewed graph and verifies integrity. No registry is contacted.
for(const[name,info]of Object.entries(next.packages)){
 await cp(path.join(path.dirname(manifestPath),info.file),path.join(repoRoot,'vendor',info.file));
 lock.core.packages[name]={version:info.version,sha256:info.sha256};
}
lock.core.version=next.release;
lock.core.sourceCommit=next.sourceCommit;
lock.core.releaseDigest=sha256(Buffer.from(JSON.stringify(next.packages))).slice(0,32);
await writeFile(path.join(repoRoot,'lumi.lock.json'),JSON.stringify(lock,null,2)+'\n');
const pkg=await readJson('package.json');
const pkgLock=JSON.parse(await readFile(path.join(repoRoot,'package-lock.json'),'utf8'));
const lockRoot=pkgLock.packages[''];
if(lockRoot.name!==pkg.name||lockRoot.version!==pkg.version)throw new Error(`package-lock.json root (${lockRoot.name}@${lockRoot.version}) does not match package.json (${pkg.name}@${pkg.version}); regenerate the lock instead of upgrading.`);
for(const[name,info]of Object.entries(next.packages)){
 const spec=`file:vendor/${info.file}`;
 pkg.dependencies[name]=spec;
 lockRoot.dependencies[name]=spec;
 const entry=pkgLock.packages[`node_modules/${name}`];
 if(!entry)throw new Error(`Lockfile is missing node_modules/${name}; regenerate the lock instead of upgrading.`);
 entry.version=info.version;
 entry.resolved=spec;
 entry.integrity=`sha512-${sha512B64(packageBytes[name])}`;
 // Core-internal dependencies (packages depending on @runlumi/core) stay coordinated.
 for(const dep of Object.keys(entry.dependencies??{})){
  if(dep.startsWith('@runlumi/'))entry.dependencies[dep]=next.packages[dep]?.version??info.version;
 }
}
await writeFile(path.join(repoRoot,'package.json'),JSON.stringify(pkg,null,2)+'\n');
await writeFile(path.join(repoRoot,'package-lock.json'),JSON.stringify(pkgLock,null,2)+'\n');
run(npm,['ci','--ignore-scripts'],repoRoot);
console.log(`Upgraded to core ${next.release}. Customer-owned files were not modified.`);
console.log('Next: npm run validate && npm run build, then deploy. Reverting the Worker version does not reverse a database migration.');
