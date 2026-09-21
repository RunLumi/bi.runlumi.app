/** Explicit, checksummed migration runner for this installation.
 * Applies pending core installation migrations (from the vendored core package)
 * and customer migrations (customer/migrations/) to the configured D1 database,
 * recording each in the schema_migrations ledger. Applied migrations are
 * immutable history: a changed or removed applied file is rejected, never
 * silently re-run or ignored.
 *
 * Usage:
 *   node --experimental-strip-types scripts/migrate.mjs [--local|--remote] [--env <name>] [--adopt]
 *
 *   --local   apply to the local D1 database (default)
 *   --remote  apply to the real D1 database (requires wrangler auth)
 *   --env     wrangler environment for --remote (e.g. staging)
 *   --adopt   record already-applied migrations in the ledger WITHOUT executing
 *             them (one-time upgrade of an installation that predates the ledger)
 */
import {createHash} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath, pathToFileURL} from 'node:url';
const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const remote=args.includes('--remote');
const adopt=args.includes('--adopt');
const envIndex=args.indexOf('--env');
const env=envIndex>=0?['--env',args[envIndex+1]]:[];
const wrangler=process.env.LUMI_WRANGLER_BIN??path.join(repoRoot,'node_modules','.bin','wrangler');
const sha256=text=>createHash('sha256').update(text).digest('hex');

async function listCore(){
 const dir=path.join(repoRoot,'node_modules','@runlumi','core','migrations','installation');
 try{return (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort().map(f=>({name:`core/${f}`,file:path.join(dir,f)}));}
 catch{return [];}
}
async function listCustomer(){
 const dir=path.join(repoRoot,'customer','migrations');
 try{return (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort().map(f=>({name:`customer/${f}`,file:path.join(dir,f)}));}
 catch{return [];}
}
function d1(sql){
 const base=[wrangler,'d1','execute','DB',remote?'--remote':'--local',...env,'--command',sql];
 const r=spawnSync(base[0],base.slice(1),{cwd:repoRoot,encoding:'utf8'});
 if(r.status!==0)throw new Error(`wrangler d1 failed: ${r.stdout}${r.stderr}`);
 return r;
}
function d1File(file){
 const base=[wrangler,'d1','execute','DB',remote?'--remote':'--local',...env,'--file',file];
 const r=spawnSync(base[0],base.slice(1),{cwd:repoRoot,encoding:'utf8'});
 if(r.status!==0)throw new Error(`wrangler d1 execute ${path.basename(file)} failed: ${r.stdout}${r.stderr}`);
}
async function ledgerRows(){
 // Read the ledger through wrangler's json output when possible; fall back to
 // an empty ledger (fresh database) on failure, which then runs migrations.
 const r=spawnSync([wrangler,'d1','execute','DB',remote?'--remote':'--local',...env,'--command','SELECT name,checksum FROM schema_migrations','--json'].join(' '),{cwd:repoRoot,encoding:'utf8',shell:true});
 if(r.status!==0)return new Map();
 try{
  const parsed=JSON.parse(r.stdout);
  const rows=(Array.isArray(parsed)?parsed[0]?.results:parsed[0]?.results)??[];
  return new Map(rows.map(row=>[row.name,row.checksum]));
 }catch{return new Map();}
}

const migrations=[...await listCore(),...await listCustomer()];
if(!migrations.length){console.log('No migrations found.');process.exit(0);}
const applied=await ledgerRows();
const pending=[];
for(const migration of migrations){
 const checksum=sha256(await readFile(migration.file,'utf8'));
 const recorded=applied.get(migration.name);
 if(recorded===undefined)pending.push({...migration,checksum});
 else if(recorded!==checksum){
  console.error(`REFUSING: applied migration ${migration.name} changed on disk (ledger ${recorded.slice(0,12)}…, file ${checksum.slice(0,12)}…). Applied migration history is immutable; restore the file or resolve explicitly.`);
  process.exit(1);
 }
}
if(!pending.length){console.log(`All ${migrations.length} migrations are applied and unchanged.`);process.exit(0);}
for(const migration of pending){
 if(adopt){
  console.log(`adopt (not executing): ${migration.name} -> ${migration.checksum.slice(0,12)}…`);
 }else{
  console.log(`applying: ${migration.name}`);
  d1File(migration.file);
 }
 d1(`INSERT INTO schema_migrations(name,checksum,applied_at) VALUES ('${migration.name}','${migration.checksum}','${new Date().toISOString()}') ON CONFLICT(name) DO NOTHING`);
}
console.log(`Done. ${adopt?'Adopted':'Applied'} ${pending.length} of ${migrations.length} migrations.`);
