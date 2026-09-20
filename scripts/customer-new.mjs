import {cp, mkdir, readFile, writeFile, readdir, stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
// Generate a customer application repository from the minimal starter plus real
// packaged core artifacts. Local and side-effect-free: no repository, no billable
// resource, no registry contact. Packaging must have run first (npm run core:pack).
const root=fileURLToPath(new URL('../',import.meta.url));
const starter=path.join(root,'starter/customer');
const artifacts=path.join(root,'artifacts/core');

const args=process.argv.slice(2);
const option=name=>{const i=args.indexOf(`--${name}`);return i>=0?args[i+1]:undefined;};
const destination=option('dest');
const customerId=option('customer');
const displayName=option('name')??option('customer');
const environment=option('env')??'production';
if(!destination||!customerId)throw new Error('Usage: node scripts/customer-new.mjs --customer <id> [--name "Display Name"] --dest <directory> [--env production]');
if(!/^[a-z0-9][a-z0-9-]{0,62}$/.test(customerId)||/^0+$/.test(customerId.replaceAll('-','')))throw new Error('Invalid customer id');
const target=path.resolve(destination);
if((await stat(target).catch(()=>null))&&(await readdir(target).catch(()=>[])).length)throw new Error(`Destination is not empty: ${target}`);

const manifest=JSON.parse(await readFile(path.join(artifacts,'lumi-core-manifest.json'),'utf8').catch(()=>{throw new Error('Core artifacts missing. Run: npm run core:pack');}));
const deploymentId=`${customerId}-${environment}`;
const substitutions={
 __CUSTOMER_ID__:customerId,
 __DISPLAY_NAME__:displayName,
 __DEPLOYMENT_ID__:deploymentId,
 __ENVIRONMENT__:environment,
 __CORE_VERSION__:manifest.release,
 __TEMPLATE_VERSION__:String(manifest.templateVersion),
 __SOURCE_COMMIT__:manifest.sourceCommit,
 __RELEASE_DIGEST__:createHash('sha256').update(JSON.stringify(manifest.packages)).digest('hex').slice(0,32),
 __CORE_SHA256__:manifest.packages['@runlumi/core'].sha256,
 __CLOUDFLARE_SHA256__:manifest.packages['@runlumi/cloudflare'].sha256,
 __UI_SHA256__:manifest.packages['@runlumi/ui'].sha256,
 __CORE_TARBALL__:`file:vendor/${manifest.packages['@runlumi/core'].file}`,
 __CLOUDFLARE_TARBALL__:`file:vendor/${manifest.packages['@runlumi/cloudflare'].file}`,
 __UI_TARBALL__:`file:vendor/${manifest.packages['@runlumi/ui'].file}`,
 __HOSTNAME__:`${customerId}.bi.runlumi.app`,
 __ACCESS_TEAM__:'replace-access-team',
 __ACCESS_AUD__:'a'.repeat(32),
 __CONTROL_WORKER__:'lumi-control',
 __DATABASE_NAME__:`${customerId}-serving`,
 __DATABASE_ID__:'00000000-0000-0000-0000-000000000000',
 __SOURCES_BUCKET__:`${customerId}-sources`
};
const substitute=source=>source.replace(/__[A-Z][A-Z0-9_]*__/g,match=>{if(!(match in substitutions))throw new Error(`Missing substitution ${match}`);return substitutions[match];});
// Files copied from the starter, with templated files losing their .template suffix.
const SKIP=new Set(['template.json','node_modules']);
const KEEP_DOT=new Set(['.github','.gitignore.template']);
async function copyTemplate(from,to){
 await mkdir(to,{recursive:true});
 for(const entry of await readdir(from,{withFileTypes:true})){
  if(entry.name.startsWith('.')&&!KEEP_DOT.has(entry.name))continue;
  if(SKIP.has(entry.name))continue;
  const source=path.join(from,entry.name);
  if(entry.isDirectory()){await copyTemplate(source,path.join(to,entry.name));continue;}
  const text=substitute(await readFile(source,'utf8'));
  const name=entry.name.endsWith('.template')?entry.name.slice(0,-'.template'.length):entry.name;
  await writeFile(path.join(to,name),text,{mode:0o644});
 }
}
await copyTemplate(starter,target);
// Vendor the exact packaged artifacts so the build is reproducible and offline.
await mkdir(path.join(target,'vendor'),{recursive:true});
for(const info of Object.values(manifest.packages))await cp(path.join(artifacts,info.file),path.join(target,'vendor',info.file));
await writeFile(path.join(target,'vendor','lumi-core-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
console.log(`Generated customer application at ${target}`);
console.log('Next: cd into it, npm install, npm run validate, npm run build. No external repository or Cloudflare resource was created.');
