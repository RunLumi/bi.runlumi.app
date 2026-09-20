/** Validate customer configuration before build or deployment.
 * Fails closed on invalid identity, unknown modules, reserved-route collisions,
 * incompatible core versions and environment/resource mismatches. */
import {readFile, readdir, access} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath, pathToFileURL} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(root,'..');
const readJson=async p=>JSON.parse(await readFile(path.join(repoRoot,p),'utf8'));
const exists=async p=>{try{await access(path.join(repoRoot,p));return true;}catch{return false;}};
const problems=[];
const require_=(condition,message)=>{if(!condition)problems.push(message);};

try{
 const {parseCustomerManifest,assertCompatible}=await import('@runlumi/core/customer-config.ts');
 const {LUMI_CORE_VERSION,LUMI_EXTENSION_API}=await import('@runlumi/core/version.ts');
 const lock=await readJson('lumi.lock.json');
 const manifestModule=await import(pathToFileURL(path.join(repoRoot,'customer/manifest.ts')).href);
 const manifest=parseCustomerManifest(manifestModule.manifest);
 assertCompatible(lock.core.version,LUMI_CORE_VERSION,lock.core.extensionApi,LUMI_EXTENSION_API);
 require_(lock.customerId===manifest.customerId,`lumi.lock.json customerId ${lock.customerId} does not match manifest ${manifest.customerId}`);
 // Customer pages must not collide with reserved core routes.
 const reserved=new Set(['/','/money','/commerce-data','/operations','/configuration','/control']);
 const customPaths=(lock.customerPages??[]).map(p=>p.path);
 for(const route of customPaths){
  require_(/^\/[a-z0-9][a-z0-9/-]{0,63}$/.test(route),`invalid custom route ${route}`);
  require_(!reserved.has(route),`customer route ${route} collides with a reserved core route`);
  require_(new Set(customPaths).size===customPaths.length,`duplicate custom route ${route}`);
 }
 const worker=await readFile(path.join(repoRoot,'apps/worker/wrangler.jsonc'),'utf8');
 require_(/workers_dev":\s*false/.test(worker),'wrangler must disable workers_dev');
 require_(/preview_urls":\s*false/.test(worker),'wrangler must disable preview_urls');
 require_(/CUSTOMER_ID/.test(worker),'wrangler must declare a server-owned CUSTOMER_ID');
 const envName=lock.environment??'production';
 if(await exists(`infra/environments/${envName}.json`)){
  const inventory=await readJson(`infra/environments/${envName}.json`);
  require_(inventory.customerId===manifest.customerId,'inventory customerId does not match the manifest');
  require_(inventory.deploymentId===lock.deploymentId,'inventory deploymentId does not match lumi.lock.json');
  require_(Boolean(inventory.hostname)&&!inventory.hostname.endsWith('.workers.dev'),'inventory hostname must be a reviewed custom hostname');
  require_(inventory.workersDev===false&&inventory.previewUrls===false,'production must disable workers.dev and preview URLs');
  require_(typeof inventory.accessAudience==='string'&&/^[a-f0-9]{20,128}$/i.test(inventory.accessAudience),'each deployment needs its own Access audience');
 }
 for(const file of ['apps/worker/wrangler.jsonc','apps/web/src/App.tsx','customer/manifest.ts','lumi.lock.json'])require_(await exists(file),`required file missing: ${file}`);
 for(const migration of (await exists('customer/migrations')?await readdir(path.join(repoRoot,'customer/migrations')):[])){
  require_(/^\d{4}_[a-z0-9_]+\.sql$/.test(migration),`customer migration must be numbered and namespaced: ${migration}`);
 }
 if(!problems.length)console.log(`Customer configuration valid for ${manifest.customerId} (core ${lock.core.version}, ${customPaths.length} custom routes).`);
}catch(error){problems.push(error.message);}

if(problems.length){console.error('Customer configuration invalid:');for(const p of problems)console.error(` - ${p}`);process.exit(1);}
