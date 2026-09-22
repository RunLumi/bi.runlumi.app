import {cp, mkdir, readFile, writeFile, readdir, stat, access, rm} from 'node:fs/promises';
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath, pathToFileURL} from 'node:url';
// Generate a customer application repository from the minimal starter plus real
// packaged core artifacts. No repository or billable resource is created. The
// generated lockfile ships with the starter template: generation is a reviewed
// file copy with no registry contact and no resolution step, so it cannot be
// perturbed by npm cache state or registry metadata quirks. Packaging must have
// run first so the starter lock and the artifacts describe the same release.
// Every requested environment gets its own deployment inventory, Worker name,
// hostname, Access audience, serving D1, R2 bucket and wrangler environment, so
// production and staging never reuse resources.
const root=fileURLToPath(new URL('../',import.meta.url));
const ident=v=>/^[a-z0-9][a-z0-9-]{0,62}$/.test(v)&&!/^0+$/.test(v.replaceAll('-',''));
const uuid=()=>randomUUID();

/** Deployment inventory for one customer/environment: logical customer identity
 * plus server-owned deployment identity and distinct resource names. Scaffold
 * default; operators review the hostname (hostnameReviewed), Access team and D1
 * before `npm run deploy:plan` approves a real deployment. */
export function environmentInventory(customerId,environment){
 return {
  schemaVersion:2,
  customerId,
  deploymentId:`${customerId}-${environment}`,
  environment,
  workerName:`${customerId}-${environment}`,
  hostname:`${customerId}-${environment}.bi.runlumi.app`,
  hostnameReviewed:false,
  workersDev:false,
  previewUrls:false,
  accessTeam:'replace-access-team',
  accessAudience:randomBytes(16).toString('hex'),
  database:{binding:'DB',databaseName:`${customerId}-${environment}-db`,databaseId:uuid()},
  sourcesBucket:`${customerId}-${environment}-sources`,
  note:'Customer/environment deployment inventory. Non-secret identifiers only; credentials and tokens live in Cloudflare secrets, never in Git. Set hostnameReviewed:true only for a real reviewed custom hostname protected by Access.'
 };
}
/** Effective Wrangler configuration: production is the top-level deployment;
 * every other environment overrides name, route, Access vars, serving D1 and R2. */
export function wranglerConfig(inventories){
 const production=inventories.find(i=>i.environment==='production');
 if(!production)throw new Error('A production environment is required for the wrangler base configuration');
 const d1=i=>({binding:'DB',database_name:i.database.databaseName,database_id:i.database.databaseId,migrations_dir:'../../migrations'});
 const vars=i=>({DEPLOYMENT_ID:i.deploymentId,ENVIRONMENT:i.environment,ACCESS_TEAM:i.accessTeam,ACCESS_AUD:i.accessAudience});
 const config={
  $schema:'node_modules/wrangler/config-schema.json',
  name:production.workerName,
  main:'src/index.ts',
  compatibility_date:'2026-09-20',
  workers_dev:false,
  preview_urls:false,
  routes:[{pattern:production.hostname,custom_domain:true}],
  assets:{directory:'../web/dist',binding:'ASSETS',not_found_handling:'single-page-application',run_worker_first:['/api/*','/healthz']},
  vars:vars(production),
  d1_databases:[d1(production)],
  r2_buckets:[{binding:'SOURCES',bucket_name:production.sourcesBucket}],
  limits:{cpu_ms:50}
 };
 const env={};
 for(const i of inventories){
  if(i.environment==='production')continue;
  env[i.environment]={name:i.workerName,routes:[{pattern:i.hostname,custom_domain:true}],vars:vars(i),d1_databases:[d1(i)],r2_buckets:[{binding:'SOURCES',bucket_name:i.sourcesBucket}]};
 }
 if(Object.keys(env).length)config.env=env;
 return config;
}

export async function generateCustomer({customerId,displayName,envs=['production'],dest,artifactsDir=path.join(root,'artifacts/core'),starterDir=path.join(root,'starter/customer')}){
 if(!dest||!customerId)throw new Error('generateCustomer requires customerId and dest');
 if(!ident(customerId))throw new Error('Invalid customer id');
 const environments=[...new Set(envs.map(e=>String(e).trim()))];
 if(!environments.includes('production'))throw new Error('A production environment must be generated');
 for(const environment of environments)if(!['production','staging','preview'].includes(environment))throw new Error(`Unsupported environment ${environment}`);
 const target=path.resolve(dest);
 if((await stat(target).catch(()=>null))&&(await readdir(target).catch(()=>[])).length)throw new Error(`Destination is not empty: ${target}`);

 const manifest=JSON.parse(await readFile(path.join(artifactsDir,'lumi-core-manifest.json'),'utf8').catch(()=>{throw new Error('Core artifacts missing. Run: npm run core:pack');}));
 const inventories=environments.map(environment=>environmentInventory(customerId,environment));
 const production=inventories.find(i=>i.environment==='production');
 const deploymentId=`${customerId}-${production.environment}`;
 const substitutions={
  __CUSTOMER_ID__:customerId,
  __DISPLAY_NAME__:displayName??customerId,
  __DEPLOYMENT_ID__:deploymentId,
  __ENVIRONMENT__:production.environment,
  __WORKER_NAME__:production.workerName,
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
  __HOSTNAME__:production.hostname,
  __ACCESS_TEAM__:production.accessTeam,
  __ACCESS_AUD__:production.accessAudience,
  __DATABASE_NAME__:production.database.databaseName,
  __DATABASE_ID__:production.database.databaseId,
  __SOURCES_BUCKET__:production.sourcesBucket
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
 await copyTemplate(starterDir,target);
 // Vendor the exact packaged artifacts so the build is reproducible and offline.
 await mkdir(path.join(target,'vendor'),{recursive:true});
 for(const info of Object.values(manifest.packages))await cp(path.join(artifactsDir,info.file),path.join(target,'vendor',info.file));
 await writeFile(path.join(target,'vendor','lumi-core-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 // Verify the starter lockfile matches the exact artifacts being vendored. The
 // lock is the reviewed, complete dependency graph; a mismatch here would make the
 // documented `npm ci` first-install fail or install the wrong core release.
 const lockText=await readFile(path.join(target,'package-lock.json'),'utf8');
 const generatedLock=JSON.parse(lockText);
 const rootPkg=generatedLock.packages[''];
 if(rootPkg.name!==customerId+'-lumi-app')throw new Error(`Starter lock root name ${rootPkg.name} does not match customer id ${customerId}`);
 if(rootPkg.version!=='0.1.3')throw new Error(`Starter lock root version ${rootPkg.version} is not 0.1.3`);
 if(generatedLock.packages['node_modules/@runlumi/core']?.version!==manifest.release)throw new Error(`Starter lock pins core ${generatedLock.packages['node_modules/@runlumi/core']?.version} but artifacts are release ${manifest.release}. Regenerate the starter lock (npm run refresh:customer-lock) after core:pack.`);
 for(const[name,info]of Object.entries(manifest.packages)){
  const expected=`file:vendor/${info.file}`;
  if(rootPkg.dependencies?.[name]!==expected)throw new Error(`Starter lock dependency ${name} is ${rootPkg.dependencies?.[name]} but the release packages ${expected}`);
  const entry=generatedLock.packages[`node_modules/${name}`];
  if(entry?.resolved!==expected)throw new Error(`Starter lock resolved for ${name} is ${entry?.resolved} but the release packages ${expected}`);
  if(!/^sha512-/.test(entry?.integrity??''))throw new Error(`Starter lock entry for ${name} lacks sha512 integrity`);
  await access(path.join(target,'vendor',info.file));
  // file: dependencies are not integrity-rechecked by npm: the generated lock
  // must carry exactly the sha512 of the tarball being vendored, or a stale
  // starter lock would silently install different bytes than the release.
  const actual='sha512-'+createHash('sha512').update(await readFile(path.join(target,'vendor',info.file))).digest('base64');
  if(entry.integrity!==actual)throw new Error(`Starter lock integrity for ${name} does not match the packaged tarball (lock ${entry.integrity.slice(0,20)}… vs artifact ${actual.slice(0,20)}…). Run npm run core:pack && npm run refresh:customer-lock, then regenerate.`);
 }
 // Per-environment deployment inventories (replace the scaffold copy) and the
 // effective multi-environment Wrangler configuration.
 for(const inventory of inventories)await writeFile(path.join(target,'infra/environments',`${inventory.environment}.json`),JSON.stringify(inventory,null,2)+'\n',{mode:0o644});
 await writeFile(path.join(target,'apps/worker/wrangler.jsonc'),JSON.stringify(wranglerConfig(inventories),null,2)+'\n',{mode:0o644});
 console.log(`Generated customer application at ${target} (${environments.join(', ')})`);
 console.log(`  production hostname: ${production.hostname}  staging hostname: ${inventories.map(i=>i.environment+'→'+i.hostname).join('  ')}`);
 console.log('Next: cd into it, npm ci, npm run validate, npm run build. No external repository or Cloudflare resource was created.');
 return {target,inventories};
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const args=process.argv.slice(2);
 const option=name=>{const i=args.indexOf(`--${name}`);return i>=0?args[i+1]:undefined;};
 const destination=option('dest');
 const customerId=option('customer');
 const displayName=option('name')??option('customer');
 const envs=(option('env')??'production').split(',').map(s=>s.trim()).filter(Boolean);
 generateCustomer({customerId,displayName,envs,dest:destination}).catch(e=>{console.error(e.message);process.exit(1);});
}
