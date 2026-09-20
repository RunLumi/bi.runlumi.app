/** Generate a deployment plan. Creates no Cloudflare resource and contacts no API.
 * Fails closed when the deployment inventory is incomplete or a resource is reused. */
import {readFile, access} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(root,'..');
const readJson=async p=>JSON.parse(await readFile(path.join(repoRoot,p),'utf8'));
const environment=process.argv[2]??'production';
const lock=await readJson('lumi.lock.json');
const inventory=await readJson(`infra/environments/${environment}.json`);
const problems=[];
const require_=(condition,message)=>{if(!condition)problems.push(message);};
require_(inventory.customerId===lock.customerId,`inventory customerId must equal ${lock.customerId}`);
require_(inventory.deploymentId===lock.deploymentId,`inventory deploymentId must equal ${lock.deploymentId}`);
require_(inventory.workersDev===false&&inventory.previewUrls===false,'production must disable workers.dev and preview URLs');
require_(typeof inventory.hostname==='string'&&!inventory.hostname.endsWith('.workers.dev')&&!inventory.hostname.endsWith('.example.com'),'a reviewed custom hostname protected by Access is required');
require_(/^[a-f0-9]{20,128}$/i.test(inventory.accessAudience),'a per-deployment Access audience is required');
require_(inventory.servingDatabase?.binding==='SERVING','exactly one fixed serving binding is required');
await access(path.join(repoRoot,'apps/web/dist/index.html')).catch(()=>problems.push('browser bundle missing: run npm run build first'));
if(problems.length){console.error('Deployment plan blocked:');for(const p of problems)console.error(` - ${p}`);process.exit(1);}
console.log(`Deployment plan for ${inventory.customerId} (${environment})`);
console.log(`  worker:        ${inventory.customerId}-lumi`);
console.log(`  hostname:      ${inventory.hostname} (Access audience ${String(inventory.accessAudience).slice(0,8)}…)`);
console.log(`  serving D1:    ${inventory.servingDatabase.databaseName} [fixed binding SERVING]`);
console.log(`  sources R2:    ${inventory.sourcesBucket}`);
console.log(`  control:       ${inventory.controlWorker} (private service binding)`);
console.log('Plan only: no Cloudflare resource, hostname, DNS record or secret was created.');
console.log('Operator steps are in docs/DEPLOYMENT.md: migrate core then customer ledger, deploy the Worker, verify Access and D1 identity.');
