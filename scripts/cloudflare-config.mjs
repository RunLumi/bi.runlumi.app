import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const check = (value, pattern, label) => {
  if (typeof value !== 'string' || !pattern.test(value) || /^0+$/.test(value.replaceAll('-',''))) throw new Error(`Missing/invalid ${label}`);
  return value;
};
const uuid = (v,label) => check(v,/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i,label);
const ident = (v,label) => check(v,/^[a-z0-9][a-z0-9-]{0,62}$/,label);
const quote = value => {
  if (typeof value !== 'string' || !value || value.length > 250 || /[\x00-\x1f]/.test(value)) throw new Error('Invalid provisioning string');
  return `'${value.replaceAll("'", "''")}'`;
};
export function compileCell(i) {
  if (i?.schemaVersion !== 1 || !Array.isArray(i.tenants) || i.tenants.length < 1 || i.tenants.length > 50) throw new Error('Cell schema v1 requires 1-50 tenants (bootstrap guard, not a Cloudflare limit)');
  const cellId=ident(i.cellId,'cellId'), name=ident(i.workerName,'workerName');
  const accountId=check(i.accountId,/^[a-f0-9]{32}$/i,'accountId');
  const hostname=check(i.hostname,/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/,'hostname');
  if (hostname.endsWith('.example.com') || hostname.endsWith('.workers.dev')) throw new Error('Use a reviewed real custom hostname protected by Access');
  const team=ident(i.accessTeam,'accessTeam');
  const aud=check(i.accessAudience,/^[a-f0-9]{20,128}$/i,'accessAudience');
  const dbs=[{binding:'CONTROL_DB',database_name:ident(i.control?.databaseName,'control databaseName'),database_id:uuid(i.control?.databaseId,'control databaseId'),migrations_dir:'../migrations/control'}];
  const bindings=[],seenIds=new Set(),seenDatabases=new Set([dbs[0].database_id.toLowerCase()]);
  const seeds={},control=[];
  for (const t of i.tenants) {
    const id=ident(t.id,'tenant id'), binding=check(t.binding,/^TENANT_[A-Z][A-Z0-9_]{0,30}$/,'tenant binding');
    const databaseId=uuid(t.databaseId,'tenant databaseId');
    if(seenIds.has(id)||bindings.includes(binding)||seenDatabases.has(databaseId.toLowerCase())) throw new Error('Duplicate tenant, binding or database; shared tenant DBs are not supported by this template');
    seenIds.add(id);bindings.push(binding);seenDatabases.add(databaseId.toLowerCase());
    dbs.push({binding,database_name:ident(t.databaseName,'tenant databaseName'),database_id:databaseId,migrations_dir:'../migrations/tenant'});
    // Fail rather than override existing routing or ownership. These are one-time reviewed bootstrap statements.
    control.push(`INSERT INTO tenants (id,name,binding_name,cell_id,state) VALUES (${quote(id)},${quote(t.name)},${quote(binding)},${quote(cellId)},'active');`);
    control.push(`INSERT INTO memberships (tenant_id,issuer,subject,role,state) VALUES (${quote(id)},${quote(`https://${team}.cloudflareaccess.com`)},${quote(t.ownerSubject)},'owner','active');`);
    if(!Array.isArray(t.sources)||!t.sources.length||t.sources.length>20) throw new Error('Specify 1-20 disjoint registered sources per tenant');
    const sourceIds=new Set();
    seeds[id]=[`INSERT INTO tenant_identity (singleton,tenant_id) VALUES (1,${quote(id)});`];
    for(const s of t.sources){const sourceId=ident(s.id,'source id');if(sourceIds.has(sourceId))throw new Error('Duplicate source');sourceIds.add(sourceId);seeds[id].push(`INSERT INTO sources (tenant_id,id,name,state) VALUES (${quote(id)},${quote(sourceId)},${quote(s.name)},'active');`);}
  }
  return {config:{
    name,account_id:accountId,main:'../apps/api/src/index.ts',compatibility_date:'2026-09-20',
    workers_dev:false,preview_urls:false,routes:[{pattern:hostname,custom_domain:true}],
    assets:{directory:'../apps/web',binding:'ASSETS',not_found_handling:'single-page-application',run_worker_first:['/api/*','/healthz']},
    vars:{CELL_ID:cellId,TENANT_BINDINGS:JSON.stringify(bindings),ACCESS_TEAM:team,ACCESS_AUD:aud},
    d1_databases:dbs,r2_buckets:[{binding:'SOURCES',bucket_name:ident(i.r2Bucket,'r2Bucket')}],
    limits:{cpu_ms:50}
  },control,seeds};
}
export async function generate(inputPath) {
  const inventory=JSON.parse(await readFile(inputPath,'utf8'));
  const {config,control,seeds}=compileCell(inventory);
  const dir=path.join(root,'.generated');await mkdir(dir,{recursive:true});
  const file=path.join(dir,`wrangler.${inventory.cellId}.json`);
  await writeFile(file,JSON.stringify(config,null,2)+'\n',{mode:0o600});
  await writeFile(path.join(dir,'control-bootstrap.sql'),control.join('\n')+'\n',{mode:0o600});
  const dashboard=JSON.parse(await readFile(path.join(root,'packs/operations-cost/dashboard.json'),'utf8'));
  for(const [id,lines]of Object.entries(seeds)){
    lines.push(`INSERT INTO dashboards (tenant_id,id,definition,revision,updated_at) VALUES (${quote(id)},'operations-cost',${"'"+JSON.stringify(dashboard).replaceAll("'","''")+"'"},1,'${new Date().toISOString()}');`);
    await writeFile(path.join(dir,`tenant-${id}-bootstrap.sql`),lines.join('\n')+'\n',{mode:0o600});
  }
  console.log(`Generated ${file}. No Cloudflare API calls or deployment were performed.`);
  console.log('Review all SQL, protect the hostname with Access, then follow docs/deployment.md.');
}
if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  if(process.argv.length!==3){console.error('Usage: npm run cf:config -- .local/cell.json');process.exitCode=1;}
  else try{await generate(process.argv[2]);}catch(e){console.error(e.message);process.exitCode=1;}
}
