import {spawnSync} from 'node:child_process';
import {cp, mkdir, readFile, writeFile, rm, readdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
// Build deterministic, reviewed tarballs of the shared core packages plus the
// migrations and pack assets a customer application must install at build time.
// This never publishes to a registry and never downloads from one.
const root=fileURLToPath(new URL('../',import.meta.url));
const outDir=path.join(root,'artifacts','core');
const npmBin=process.env.LUMI_NPM_BIN??'/opt/homebrew/bin/npm';
const git=args=>spawnSync('git',args,{cwd:root,encoding:'utf8'}).stdout?.trim()??'';
const coreVersion=JSON.parse(await readFile(path.join(root,'packages/core/package.json'),'utf8')).version;
const templateVersion=JSON.parse(await readFile(path.join(root,'starter/customer/template.json'),'utf8')).templateVersion;
const SOURCE_COMMIT=process.env.LUMI_SOURCE_COMMIT??git(['rev-parse','HEAD']);
const SOURCE_DIRTY=git(['status','--porcelain']).length>0;

if(SOURCE_DIRTY&&process.env.LUMI_ALLOW_DIRTY!=='1')throw new Error('Refusing to package from a dirty tree. Commit reviewed changes or set LUMI_ALLOW_DIRTY=1 for a local experiment.');
if(!/^[a-f0-9]{40}$/.test(SOURCE_COMMIT))throw new Error('Could not resolve a source commit');

await rm(outDir,{recursive:true,force:true});
await mkdir(outDir,{recursive:true});

// 1. Migrations are upstream-owned, immutable and checksummed. Stage them into
// the core package so they ship inside the tarball instead of by relative path.
const migrationSource=path.join(root,'migrations');
const migrationTarget=path.join(root,'packages/core/migrations');
await rm(migrationTarget,{recursive:true,force:true});
await cp(migrationSource,migrationTarget,{recursive:true});
const checksums={};
for(const plane of ['control','tenant']){
 for(const file of (await readdir(path.join(migrationSource,plane))).filter(f=>f.endsWith('.sql')).sort()){
  const body=await readFile(path.join(migrationSource,plane,file),'utf8');
  checksums[`migrations/${plane}/${file}`]=createHash('sha256').update(body).digest('hex');
 }
}

// 2. Build each package, then emit a real tarball.
const tarballs={};
for(const name of ['core','cloudflare','ui']){
 const dir=path.join(root,'packages',name);
 const pkg=JSON.parse(await readFile(path.join(dir,'package.json'),'utf8'));
 const build=spawnSync(npmBin,['run','build','--workspace',`@runlumi/${name}`],{cwd:root,stdio:'inherit'});
 if(build.status!==0)process.exit(build.status??1);
 const pack=spawnSync(npmBin,['pack','--pack-destination',outDir,'--json'],{cwd:dir,encoding:'utf8'});
 if(pack.status!==0){process.stderr.write(pack.stderr??'');process.exit(pack.status??1);}
 const [entry]=JSON.parse(pack.stdout);
 const filename=entry.filename;
 const digest=createHash('sha256').update(await readFile(path.join(outDir,filename))).digest('hex');
 tarballs[pkg.name]={version:pkg.version,file:filename,sha256:digest,files:entry.files.map(f=>f.path).sort()};
}
await rm(migrationTarget,{recursive:true,force:true});

// 3. Provenance record consumed by customer lumi.lock.json and the upgrade command.
const manifest={schemaVersion:1,release:coreVersion,templateVersion,extensionApi:1,sourceCommit:SOURCE_COMMIT,dirty:SOURCE_DIRTY,builtAt:new Date().toISOString(),migrations:checksums,packages:tarballs};
await writeFile(path.join(outDir,'lumi-core-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Packaged core release ${coreVersion} from ${SOURCE_COMMIT.slice(0,12)}${SOURCE_DIRTY?' (dirty)':''}.`);
for(const [name,info]of Object.entries(tarballs))console.log(`  ${name}@${info.version} -> artifacts/core/${info.file} (${info.files.length} files)`);
console.log('No package was published and no registry was contacted.');
