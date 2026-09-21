/** Validate customer configuration before build or deployment.
 * Fails closed on invalid identity, unknown modules, reserved-route collisions,
 * incompatible core versions, environment inventories and resource reuse.
 * This is scaffold validation: placeholder values are structurally checked but
 * deployable-release review (real hostname, reviewed Access team, real D1) is
 * the separate `deploy:plan` gate. */
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
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)&&!/^0+$/.test(v.replaceAll('-',''));
const ident=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9-]{0,62}$/.test(v)&&!/^0+$/.test(v.replaceAll('-',''));

try{
 const {parseCustomerManifest,assertCompatible,parseDecisionRules}=await import('@runlumi/core/customer-config.ts');
 const {LUMI_CORE_VERSION,LUMI_EXTENSION_API}=await import('@runlumi/core/version.ts');
 const lock=await readJson('lumi.lock.json');
 const manifestModule=await import(pathToFileURL(path.join(repoRoot,'customer/manifest.ts')).href);
 const manifest=parseCustomerManifest(manifestModule.manifest);
 assertCompatible(lock.core.version,LUMI_CORE_VERSION,lock.core.extensionApi,LUMI_EXTENSION_API);
 require_(lock.customerId===manifest.customerId,`lumi.lock.json customerId ${lock.customerId} does not match manifest ${manifest.customerId}`);
 // Customer pages must not collide with reserved core routes.
 const reserved=new Set(['/','/money','/commerce-data','/operations','/configuration','/control']);
 const customPaths=(lock.customerPages??[]).map(p=>p.path);
 const seenPaths=new Set();
 for(const route of customPaths){
  require_(/^\/[a-z0-9][a-z0-9/-]{0,63}$/.test(route),`invalid custom route ${route}`);
  require_(!reserved.has(route),`customer route ${route} collides with a reserved core route`);
  require_(!route.startsWith('/api/'),`customer route ${route} collides with the API namespace`);
  require_(!seenPaths.has(route),`duplicate custom route ${route}`);
  seenPaths.add(route);
 }
 // Every environment inventory must be customer-scoped and resource-distinct.
 const envFiles=(await readdir(path.join(repoRoot,'infra/environments'))).filter(f=>f.endsWith('.json')).sort();
 require_(envFiles.length>=1,'no environment inventory found under infra/environments');
 const seen={workerName:new Map(),hostname:new Map(),databaseName:new Map(),databaseId:new Map(),sourcesBucket:new Map(),accessAudience:new Map(),deploymentId:new Map()};
 const inventories=[];
 for(const file of envFiles){
  const inventory=await readJson(`infra/environments/${file}`);
  require_(inventory.schemaVersion===2,`${file}: inventory schema must be version 2`);
  require_(inventory.customerId===manifest.customerId,`${file}: inventory customerId does not match the manifest`);
  require_(inventory.environment===file.slice(0,-'.json'.length),`${file}: inventory environment must match its filename`);
  require_(inventory.deploymentId===`${inventory.customerId}-${inventory.environment}`,`${file}: deploymentId must be <customerId>-<environment>`);
  require_(ident(inventory.workerName)&&inventory.workerName===inventory.deploymentId,`${file}: workerName must equal deploymentId`);
  require_(typeof inventory.hostname==='string'&&!inventory.hostname.endsWith('.workers.dev')&&!inventory.hostname.endsWith('.example.com'),`${file}: hostname must be a custom hostname`);
  require_(inventory.workersDev===false&&inventory.previewUrls===false,`${file}: workers.dev and preview URLs must be disabled`);
  require_(ident(inventory.accessTeam),`${file}: accessTeam must be a valid Cloudflare Access team`);
  require_(typeof inventory.accessAudience==='string'&&/^[A-Za-z0-9_-]{20,128}$/.test(inventory.accessAudience),`${file}: each deployment needs its own Access audience`);
  require_(inventory.database?.binding==='DB',`${file}: exactly one fixed DB binding is required`);
  require_(ident(inventory.database?.databaseName),`${file}: database name is required`);
  require_(uuid(inventory.database?.databaseId),`${file}: database id must be a non-zero UUID`);
  require_(ident(inventory.sourcesBucket),`${file}: sources bucket is required`);
  inventories.push(inventory);
  for(const key of Object.keys(seen)){
   const value=String(key==='databaseName'?inventory.database?.databaseName:key==='databaseId'?inventory.database?.databaseId:inventory[key]);
   if(seen[key].has(value))require_(false,`${file}: ${key} ${value} is reused by ${seen[key].get(value)}; deployments must own distinct resources`);
   seen[key].set(value,file);
  }
 }
 // The effective Wrangler configuration must match the inventories exactly.
 const workerConfig=JSON.parse(await readFile(path.join(repoRoot,'apps/worker/wrangler.jsonc'),'utf8'));
 require_(workerConfig.workers_dev===false&&workerConfig.preview_urls===false,'wrangler must disable workers_dev and preview_urls');
  require_(workerConfig.d1_databases?.length===1&&workerConfig.d1_databases[0].binding==='DB','wrangler must declare exactly one fixed DB binding');
 const base=inventories.find(i=>i.workerName===workerConfig.name);
 require_(Boolean(base)&&base.environment==='production','wrangler top-level must name the production deployment');
 for(const inventory of inventories){
  if(inventory===base){
   require_(workerConfig.name===inventory.workerName,`wrangler name must be ${inventory.workerName}`);
   require_(workerConfig.routes?.[0]?.pattern===inventory.hostname,`wrangler production route must be ${inventory.hostname}`);
   require_(workerConfig.vars?.DEPLOYMENT_ID===inventory.deploymentId&&workerConfig.vars?.ENVIRONMENT===inventory.environment,`wrangler production vars must match ${inventory.deploymentId}`);
   require_(workerConfig.vars?.ACCESS_TEAM===inventory.accessTeam&&workerConfig.vars?.ACCESS_AUD===inventory.accessAudience,`wrangler production Access vars must match the inventory`);
   require_(workerConfig.d1_databases[0].database_name===inventory.database.databaseName&&workerConfig.d1_databases[0].database_id===inventory.database.databaseId,`wrangler production database must match the inventory`);
   require_(workerConfig.r2_buckets?.[0]?.bucket_name===inventory.sourcesBucket,`wrangler production sources bucket must match the inventory`);
  }else{
   const section=workerConfig.env?.[inventory.environment];
   require_(Boolean(section),`wrangler is missing env section ${inventory.environment}`);
   require_(section.name===inventory.workerName,`wrangler env ${inventory.environment} name must be ${inventory.workerName}`);
   require_(section.routes?.[0]?.pattern===inventory.hostname,`wrangler env ${inventory.environment} route must be ${inventory.hostname}`);
   require_(section.vars?.DEPLOYMENT_ID===inventory.deploymentId&&section.vars?.ENVIRONMENT===inventory.environment,`wrangler env ${inventory.environment} vars must match the inventory`);
   require_(section.vars?.ACCESS_TEAM===inventory.accessTeam&&section.vars?.ACCESS_AUD===inventory.accessAudience,`wrangler env ${inventory.environment} Access vars must match the inventory`);
   require_(section.d1_databases?.[0]?.binding==='DB'&&section.d1_databases[0].database_name===inventory.database.databaseName&&section.d1_databases[0].database_id===inventory.database.databaseId,`wrangler env ${inventory.environment} database must match the inventory`);
   require_(section.r2_buckets?.[0]?.bucket_name===inventory.sourcesBucket,`wrangler env ${inventory.environment} sources bucket must match the inventory`);
  }
 }
 // Extensions must exist and stay coherent with the manifest and with the server
  // registration they are compiled against. A declared metric that is never
  // registered, or a registration for an undeclared metric, is a build-time error.
  const loadModule=async(rel,label)=>{try{return await import(pathToFileURL(path.join(repoRoot,rel)).href);}catch(error){problems.push(`${label}: cannot load: ${error?.message??error}`);return null;}};
  const metricsSource=await readFile(path.join(repoRoot,'customer/data/metrics.ts'),'utf8').catch(()=>'');
  require_(!metricsSource.includes('customMetricValue'),'customer/data/metrics.ts must not contain the no-query customMetricValue placeholder');
  const metricsModule=await loadModule('customer/data/metrics.ts','customer/data/metrics.ts');
  const serverMetricsModule=await loadModule('customer/data/server-metrics.ts','customer/data/server-metrics.ts');
  const namespace=manifest.extensions[0]?.namespace??'customer';
  if(metricsModule){
   const declared=metricsModule.customMetrics??[];
   require_(Array.isArray(declared),'customer/data/metrics.ts must export customMetrics');
   const declaredIds=new Set();
   for(const metric of declared){
    require_(typeof metric?.id==='string'&&metric.id.startsWith(`${namespace}.`),`custom metric ${metric?.id??'<missing>'} must use the ${namespace}. namespace`);
    if(!declaredIds.has(metric?.id))declaredIds.add(metric?.id);else require_(false,`duplicate custom metric id ${metric?.id}`);
    for(const source of metric?.source?.from??[])require_(manifest.modules.includes((String(source).split('.')[0])),`custom metric ${metric?.id} derives from ${source} but module ${String(source).split('.')[0]} is not enabled in the manifest`);
   }
   if(serverMetricsModule){
    const registered=serverMetricsModule.customMetricExtensions??[];
    const registeredIds=new Set((registered??[]).map(ext=>ext?.id).filter(Boolean));
    require_(registeredIds.size===declaredIds.size&&[...registeredIds].every(id=>declaredIds.has(id)),'custom metric ids declared in customer/data/metrics.ts must match the ids registered in customer/data/server-metrics.ts');
   }
  }
  const decisionsModule=await loadModule('customer/workflows/decisions.ts','customer/workflows/decisions.ts');
  if(decisionsModule){
   try{parseDecisionRules(decisionsModule.decisionRules);}catch(error){problems.push(`customer/workflows/decisions.ts: ${error?.message??error}`);}
   for(const rule of decisionsModule.decisionRules??[])require_(typeof rule?.id==='string'&&rule.id.startsWith(`${namespace}.`),`decision rule ${rule?.id??'<missing>'} must use the ${namespace}. namespace`);
  }
  const aiModule=await loadModule('customer/ai/profile.ts','customer/ai/profile.ts');
  if(aiModule){
   const profile=aiModule.aiProfile;
   require_(profile?.contextMode==='authorized-results-only','customer/ai/profile.ts must declare contextMode authorized-results-only');
   for(const prompt of profile?.prompts??[])require_(await exists(`customer/ai/${prompt.file}`),`AI prompt ${prompt.file} is missing under customer/ai`);
  }
  for(const file of ['apps/worker/wrangler.jsonc','apps/web/src/App.tsx','customer/manifest.ts','lumi.lock.json'])require_(await exists(file),`required file missing: ${file}`);
 for(const migration of (await exists('customer/migrations')?await readdir(path.join(repoRoot,'customer/migrations')):[])){
  require_(/^\d{4}_[a-z0-9_]+\.sql$/.test(migration),`customer migration must be numbered and namespaced: ${migration}`);
 }
 if(!problems.length)console.log(`Customer configuration valid for ${manifest.customerId} (core ${lock.core.version}, ${inventories.length} deployment${inventories.length===1?'':'s'}, ${customPaths.length} custom routes).`);
}catch(error){problems.push(error.message);}

if(problems.length){console.error('Customer configuration invalid:');for(const p of problems)console.error(` - ${p}`);process.exit(1);}
