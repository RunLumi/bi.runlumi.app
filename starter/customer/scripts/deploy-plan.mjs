/** Generate a deployment plan. Creates no Cloudflare resource and contacts no API.
 * Deployable-release gate: fails closed when the inventory is incomplete, scaffold
 * placeholder Access/D1 values remain, a resource is reused across environments,
 * or the browser bundle is missing. `npm run validate` is scaffold-safe; this gate
 * is the operator review milestone before a real deployment. */
import {readFile, access, readdir} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {LUMI_CONTROL_API} from '@runlumi/core/version.ts';
const root=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(root,'..');
const readJson=async p=>JSON.parse(await readFile(path.join(repoRoot,p),'utf8'));
const environment=process.argv[2]??'production';
const lock=await readJson('lumi.lock.json');
const inventory=await readJson(`infra/environments/${environment}.json`);
const problems=[];
const require_=(condition,message)=>{if(!condition)problems.push(message);};
const uuid=v=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v)&&!/^(0{8}-){3}0{12}$/.test(v);
const ident=v=>typeof v==='string'&&/^[a-z0-9][a-z0-9-]{0,62}$/.test(v)&&!/^0+$/.test(v.replaceAll('-',''));
require_(inventory.schemaVersion===2,`${environment}.json schema must be version 2`);
require_(inventory.customerId===lock.customerId,`inventory customerId must equal ${lock.customerId}`);
require_(inventory.deploymentId===`${inventory.customerId}-${environment}`,`deploymentId must be <customerId>-<environment>`);
require_(inventory.workersDev===false&&inventory.previewUrls===false,`${environment} must disable workers.dev and preview URLs`);
require_(inventory.hostnameReviewed===true,'hostname must be reviewed: replace the scaffold and set hostnameReviewed:true');
require_(typeof inventory.hostname==='string'&&!inventory.hostname.endsWith('.workers.dev')&&!inventory.hostname.endsWith('.example.com'),'a reviewed custom hostname protected by Access is required');
require_(ident(inventory.accessTeam)&&!/REPLACE|example/i.test(inventory.accessTeam),'a reviewed Access team is required (replace the scaffold value)');
require_(typeof inventory.accessAudience==='string'&&/^[A-Za-z0-9_-]{20,128}$/.test(inventory.accessAudience)&&!/^(.)\1{19,}$/.test(inventory.accessAudience)&&!/REPLACE|example/i.test(inventory.accessAudience),'a reviewed per-deployment Access audience is required');
require_(inventory.controlApiVersion===LUMI_CONTROL_API,`controlApiVersion must equal the control interface version ${LUMI_CONTROL_API}`);
require_(ident(inventory.controlWorker),'a reviewed control Worker name is required');
require_(inventory.servingDatabase?.binding==='SERVING','exactly one fixed serving binding is required');
require_(ident(inventory.servingDatabase?.databaseName),'a serving database name is required');
require_(uuid(inventory.servingDatabase?.databaseId),'a real non-zero serving database id is required');
require_(ident(inventory.sourcesBucket),'a sources bucket is required');
// AI configuration is part of the reviewed release. When inference is enabled, the
// provider instance, model and credential references must be reviewed real
// references, never scaffold placeholders. When AI is not enabled, the profile is
// informational only and cannot leak a credential.
const aiProfile=inventory.ai?.enabled===true?await import(pathToFileURL(path.join(repoRoot,'customer/ai/profile.ts')).href).then(m=>m.aiProfile??null).catch(()=>null):null;
require_(aiProfile===null||typeof aiProfile.providerInstanceRef==='string'&&!/^replace-/.test(aiProfile.providerInstanceRef),'AI provider instance must be a reviewed reference (replace the scaffold value) when AI is enabled');
require_(aiProfile===null||typeof aiProfile.modelRef==='string'&&!/^replace-/.test(aiProfile.modelRef),'AI model must be a reviewed reference (replace the scaffold value) when AI is enabled');
require_(aiProfile===null||typeof aiProfile.credentialRef==='string'&&!/^replace-/.test(aiProfile.credentialRef),'AI credential must be a real secret reference (replace the scaffold value) when AI is enabled');
// No environment may reuse another environment's resources.
for(const file of (await readdir(path.join(repoRoot,'infra/environments'))).filter(f=>f.endsWith('.json')&&f!==`${environment}.json`)){
 const other=await readJson(`infra/environments/${file}`);
 const shared=[['workerName',inventory.workerName,other.workerName],['hostname',inventory.hostname,other.hostname],['databaseName',inventory.servingDatabase?.databaseName,other.servingDatabase?.databaseName],['databaseId',inventory.servingDatabase?.databaseId,other.servingDatabase?.databaseId],['sourcesBucket',inventory.sourcesBucket,other.sourcesBucket],['accessAudience',inventory.accessAudience,other.accessAudience]];
 for(const[key,a,b]of shared)if(typeof a==='string'&&a===b)require_(false,`${key} ${a} is reused by ${environment} and ${other.environment}; deployments must own distinct resources`);
}
await access(path.join(repoRoot,'apps/web/dist/index.html')).catch(()=>problems.push('browser bundle missing: run npm run build first'));
if(problems.length){console.error('Deployment plan blocked:');for(const p of problems)console.error(` - ${p}`);process.exit(1);}
console.log(`Deployment plan for ${inventory.customerId} (${environment})`);
console.log(`  worker:        ${inventory.workerName}`);
console.log(`  hostname:      ${inventory.hostname} (Access audience ${String(inventory.accessAudience).slice(0,8)}…)`);
console.log(`  serving D1:    ${inventory.servingDatabase.databaseName} [fixed binding SERVING]`);
console.log(`  sources R2:    ${inventory.sourcesBucket}`);
console.log(`  control:       ${inventory.controlWorker} (private service binding, interface v${inventory.controlApiVersion})`);
console.log(`  ai:            ${inventory.ai?.enabled===true?`enabled (${aiProfile?.modelRef??'reviewed model'})`:'not enabled in this deployment'}`);
console.log(`  deploy:        npx wrangler deploy --config apps/worker/wrangler.jsonc${inventory.environment==='production'?'':` --env ${inventory.environment}`}`);
console.log('Plan only: no Cloudflare resource, hostname, DNS record or secret was created.');
console.log('Operator steps are in docs/DEPLOYMENT.md: register the deployment at Control, migrate core then customer ledger, deploy the Worker, verify Access and D1 identity.');