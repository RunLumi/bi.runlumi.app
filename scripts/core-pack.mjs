import {spawnSync} from 'node:child_process';
import {existsSync} from 'node:fs';
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
const npmBin=process.env.npm_execpath??process.env.LUMI_NPM_BIN??'npm';
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
await mkdir(migrationTarget,{recursive:true});
await cp(path.join(migrationSource,'installation'),path.join(migrationTarget,'installation'),{recursive:true});
const checksums={};
for(const file of (await readdir(path.join(migrationSource,'installation'))).filter(f=>f.endsWith('.sql')).sort()){
 const body=await readFile(path.join(migrationSource,'installation',file),'utf8');
 checksums[`migrations/installation/${file}`]=createHash('sha256').update(body).digest('hex');
}

// 2. Build each package, then emit a DETERMINISTIC tarball: fixed mtime, no
// gzip timestamp, sorted entries, root uid/gid. A rebuild from the same commit
// produces byte-identical artifacts anywhere, so lock integrity recorded once
// is valid in every environment (CI repacks and must match the committed lock).
import {gzipSync} from 'node:zlib';
function ustarChecksum(header){let sum=0;for(let i=0;i<512;i++)sum+=i<148||i>=156?header[i]:32;const octal=sum.toString(8).padStart(6,'0');header.write(octal,148,6,'latin1');header[154]=0;header[155]=0x20;}
function ustarEntry(name,content,mtimeSec=0){
 const data=Buffer.isBuffer(content)?content:Buffer.from(content);
 const header=Buffer.alloc(512);header.write('0',156);
 let namePart=name,prefixPart='';
 if(Buffer.byteLength(name)>100){
  const splitAt=name.lastIndexOf('/',name.length-100);
  if(splitAt<0)throw new Error(`Tarball entry name too long and unsplittable: ${name}`);
  prefixPart=name.slice(0,splitAt);namePart=name.slice(splitAt+1);
 }
 header.write(namePart,0,100);header.write('0000644\0',100);header.write('0000000\0',108);
 header.write('0000000\0',116);header.write(data.length.toString(8).padStart(11,'0')+'\0',124);
 header.write(mtimeSec.toString(8).padStart(11,'0')+'\0',136);
 header.write('ustar\0',257);header.write('00',263);
 if(prefixPart)header.write(prefixPart,345,150);
 ustarChecksum(header);
 const body=Buffer.concat([data]);
 const padding=(512-(body.length%512))%512;
 return Buffer.concat([header,body,Buffer.alloc(padding)]);
}
function deterministicTarball(files){
 // files: sorted [{name:'package/<path>',content:Buffer}]
 const chunks=[];
 for(const file of files)chunks.push(ustarEntry(file.name,file.content));
 chunks.push(Buffer.alloc(1024));
 return gzipSync(Buffer.concat(chunks),{mtime:0});
}
const tarballs={};
for(const name of ['core','cloudflare','ui']){
 const dir=path.join(root,'packages',name);
 const pkg=JSON.parse(await readFile(path.join(dir,'package.json'),'utf8'));
 const build=spawnSync(npmBin,['run','build','--workspace',`@runlumi/${name}`],{cwd:root,stdio:'inherit'});
 if(build.status!==0)process.exit(build.status??1);
 // npm-pack-equivalent content, gathered deterministically.
 const contentFiles=[];
 const addFile=async(absPath,relName)=>{
  const content=await readFile(absPath);
  contentFiles.push({name:`package/${relName}`,content});
 };
 await addFile(path.join(dir,'package.json'),'package.json');
 for(const extra of ['README.md','LICENSE']){
  if(existsSync(path.join(dir,extra)))await addFile(path.join(dir,extra),extra);
 }
 const walk=async(rel)=>{
  const abs=path.join(dir,rel);
  for(const entry of await readdir(abs,{withFileTypes:true})){
   const child=rel?`${rel}/${entry.name}`:entry.name;
   if(entry.isDirectory())await walk(child);else await addFile(path.join(abs,entry.name),child);
  }
 };
 await walk('dist');
 if(name==='core')await walk('migrations');
 contentFiles.sort((a,b)=>a.name<b.name?-1:1);
 const filename=`runlumi-${name}-${pkg.version}.tgz`;
 const tarball=deterministicTarball(contentFiles);
 await writeFile(path.join(outDir,filename),tarball);
 const digest=createHash('sha256').update(tarball).digest('hex');
 tarballs[pkg.name]={version:pkg.version,file:filename,sha256:digest,files:contentFiles.map(f=>f.name).sort()};
}
await rm(migrationTarget,{recursive:true,force:true});

// 3. Release scan: the packaged browser/Worker artifacts must not carry retired
// multi-installation constructs. Applied to the actual packaged bytes, not the
// source tree, and narrow enough to exclude legitimate business vocabulary
// (a company's own shops/channels are data, not tenancy).
const RETIRED_CONSTRUCTS=[
 [/tenant_id|tenantId\b/,'tenant identifier'],
 [/'\/api\/tenants/,'tenant API route'],
 [/CONTROL_DB|CONTROL_API|CELL_ID\b/,'control/cell bindings'],
 [/tenants\/[^'"`]*\/commerce\//,'tenant-scoped storage path'],
 [/cloudflareaccess\.com\/.*tenants/,'tenant access issuer']
];
const {gunzipSync}=await import('node:zlib');
const tarballBodies={};
for(const [pkgName,info] of Object.entries(tarballs)){
 tarballBodies[pkgName]=gunzipSync(await readFile(path.join(outDir,info.file))).toString('latin1');
}
for(const [pkgName,info] of Object.entries(tarballs)){
 const contents=tarballBodies[pkgName];
 for(const [pattern,label] of RETIRED_CONSTRUCTS){
  if(pattern.test(contents))throw new Error(`Release scan failed: @runlumi/${pkgName} contains a retired construct (${label}). Remove it before packaging.`);
 }
}
console.log('Release scan: no retired multi-installation constructs in packaged artifacts.');

// 4. Provenance record consumed by customer lumi.lock.json and the upgrade command.
const manifest={schemaVersion:1,release:coreVersion,templateVersion,extensionApi:1,sourceCommit:SOURCE_COMMIT,dirty:SOURCE_DIRTY,builtAt:new Date().toISOString(),migrations:checksums,packages:tarballs};
await writeFile(path.join(outDir,'lumi-core-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Packaged core release ${coreVersion} from ${SOURCE_COMMIT.slice(0,12)}${SOURCE_DIRTY?' (dirty)':''}.`);
for(const [name,info]of Object.entries(tarballs))console.log(`  ${name}@${info.version} -> artifacts/core/${info.file} (${info.files.length} files)`);
console.log('No package was published and no registry was contacted.');
