/** Explicit, checksummed migration runner for this installation.
 * Applies pending core installation migrations (from the vendored core package)
 * and customer migrations (customer/migrations/) to the configured D1 database,
 * recording each in the schema_migrations ledger. Applied migrations are
 * immutable history: a changed applied file is refused, and applied history
 * whose file is missing is reported before anything runs.
 *
 * Usage:
 *   npm run migrate [-- --remote] [--env <name>] [--adopt]
 *
 *   --local   apply to the local D1 database (default)
 *   --remote  apply to the real D1 database (requires wrangler auth)
 *   --env     wrangler environment (uses apps/worker/wrangler.jsonc env.<name>)
 *   --adopt   record already-applied migrations WITHOUT executing them. Refuses
 *             unless a known-compatible schema (the installation tables) exists;
 *             for installations that predate the ledger.
 *
 * Reliability contract:
 * - every wrangler invocation uses an argument array (no shell interpolation);
 * - the ledger table is bootstrapped (CREATE IF NOT EXISTS) before anything is
 *   recorded, so recording never precedes the table that stores it;
 * - a ledger read/parse failure is an error, never silently an empty ledger;
 * - a migration file is applied only if its SQL execution succeeded; the ledger
 *   row is written afterwards (SQL success and ledger acknowledgement are
 *   separate steps — re-running a partially applied migration is handled by the
 *   IF NOT EXISTS DDL used by all shipped migrations).
 */
import {createHash} from 'node:crypto';
import {readFile, readdir} from 'node:fs/promises';
import {readFileSync,existsSync} from 'node:fs';
import {spawnSync} from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const args=process.argv.slice(2);
const remote=args.includes('--remote');
const adopt=args.includes('--adopt');
const envIndex=args.indexOf('--env');
const envName=envIndex>=0?args[envIndex+1]:undefined;
const config=path.join(repoRoot,'apps','worker','wrangler.jsonc');
const sha256=text=>createHash('sha256').update(text).digest('hex');
// Resolve a directly-spawnable wrangler: node + the package's JS entry, so
// .bin shim quirks can never re-parse our arguments. LUMI_WRANGLER_BIN may
// point at any executable override for exotic environments.
const PINNED_WRANGLER_VERSION='4.123.0';
/** Resolve wrangler's actual JS entry so every invocation is
 * `node <wrangler.js> d1 execute …` — argument arrays end to end, no shim
 * re-parsing. Order: LUMI_WRANGLER_BIN (file or package root) → local
 * install → pinned npx download (cached after the first run). */
function resolveWrangler(){
 const fromPackage=(packageDir)=>{
  const manifestPath=path.join(packageDir,'package.json');
  if(!existsSync(manifestPath))return null;
  const manifest=JSON.parse(readFileSync(manifestPath,'utf8'));
  const bin=typeof manifest.bin==='string'?manifest.bin:manifest.bin.wrangler;
  const entry=path.join(packageDir,bin);
  return existsSync(entry)?{cmd:process.execPath,prefix:[entry]}:null;
 };
 const override=process.env.LUMI_WRANGLER_BIN;
 if(override){
  const resolved=existsSync(path.join(override,'package.json'))?fromPackage(override):{cmd:process.execPath,prefix:[override]};
  if(resolved)return resolved;
 }
 return fromPackage(path.join(repoRoot,'node_modules','wrangler'))
  ??{cmd:'npx',prefix:['--yes',`wrangler@${PINNED_WRANGLER_VERSION}`]};
}
const {cmd:wranglerCmd,prefix:wranglerPrefix}=resolveWrangler();
function wranglerArgs(extra){
 return [...wranglerPrefix,'d1','execute','DB',remote?'--remote':'--local','--config',config,...(envName?['--env',envName]:[]),...extra];
}
function runWrangler(extra,{json=false}={}){
 // Argument arrays only: migration names and checksums never cross a shell.
 const r=spawnSync(wranglerCmd,wranglerArgs([...(json?['--json']:[]),...extra]),{cwd:repoRoot,encoding:'utf8'});
 if(r.status!==0)throw new Error(`wrangler d1 execute failed: ${(r.stderr||r.stdout||'').slice(0,800)}`);
 return r.stdout;
}
function d1File(file){return runWrangler(['--file',file]);}
async function ledgerRows(){
 // A ledger failure is an error. Only the specific "no such table" outcome of
 // a fresh database is an empty ledger.
 let stdout;
 try{stdout=runWrangler(['--command','SELECT name,checksum FROM schema_migrations','--json']);}
 catch(error){
  if(/no such table/i.test(String(error.message)))return new Map();
  throw new Error(`Cannot read the migration ledger: ${error.message}. Refusing to guess the applied state; resolve the database access or ledger problem first.`);
 }
 try{
  const parsed=JSON.parse(stdout);
  const rows=Array.isArray(parsed)?parsed[0]?.results??[]:parsed[0]?.results??[];
  return new Map(rows.map(row=>[row.name,row.checksum]));
 }catch(error){throw new Error(`Migration ledger output is not valid JSON: ${error.message}.`);}
}
function bootstrapLedger(){
 // Same DDL as core migration 0003 (IF NOT EXISTS) so recording works before
 // that migration runs on a fresh database, and no-ops once it has.
 runWrangler(['--command',"CREATE TABLE IF NOT EXISTS schema_migrations (name TEXT PRIMARY KEY, checksum TEXT NOT NULL, applied_at TEXT NOT NULL) STRICT"]);
}
async function compatibleSchemaExists(){
 // Adoption requires evidence of a real prior schema, not just files on disk.
 try{
  const stdout=runWrangler(['--command',"SELECT name FROM sqlite_master WHERE type='table' AND name IN ('installation','users','commerce_receipts')",'--json']);
  const parsed=JSON.parse(stdout);
  const rows=Array.isArray(parsed)?parsed[0]?.results??[]:parsed[0]?.results??[];
  return rows.length>=2;
 }catch{return false;}
}

async function listMigrations(dir,prefix){
 try{return (await readdir(dir)).filter(f=>f.endsWith('.sql')).sort().map(f=>({name:`${prefix}/${f}`,file:path.join(dir,f)}));}
 catch{return null;}
}
const coreMigrations=await listMigrations(path.join(repoRoot,'node_modules','@runlumi','core','migrations','installation'),'core');
if(coreMigrations===null){console.error('Vendored core migrations not found. Run npm ci first.');process.exit(1);}
const customerMigrations=await listMigrations(path.join(repoRoot,'customer','migrations'),'customer')??[];
const migrations=[...coreMigrations,...customerMigrations];
if(!migrations.length){console.log('No migrations found.');process.exit(0);}
if(adopt){
 const schemaOk=await compatibleSchemaExists();
 if(!schemaOk){console.error('REFUSING --adopt: no compatible existing schema found (installation/users tables missing). Nothing was recorded. Run migrations normally on a fresh database.');process.exit(1);}
}
const applied=await ledgerRows();
// Applied history whose file has disappeared is reported, not ignored.
const knownNames=new Set(migrations.map(m=>m.name));
const missing=[...applied.keys()].filter(name=>!knownNames.has(name));
if(missing.length){
 console.error(`REFUSING: applied migration history references files that are no longer present: ${missing.join(', ')}. Restore the files or resolve the history explicitly.`);
 process.exit(1);
}
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
bootstrapLedger();
for(const migration of pending){
 if(adopt){
  console.log(`adopt (not executing): ${migration.name} -> ${migration.checksum.slice(0,12)}…`);
 }else{
  const body=(await readFile(migration.file,'utf8')).replace(/--[^\n]*/g,'');
  if(!/\S/.test(body)){console.log(`skipping (no statements): ${migration.name}`);continue;}
  console.log(`applying: ${migration.name}`);
  d1File(migration.file);
 }
 // Record only after the SQL step succeeded (or in explicit adopt mode).
 runWrangler(['--command',`INSERT INTO schema_migrations(name,checksum,applied_at) VALUES ('${migration.name}','${migration.checksum}','${new Date().toISOString()}') ON CONFLICT(name) DO NOTHING`]);
}
console.log(`Done. ${adopt?'Adopted':'Applied'} ${pending.length} of ${migrations.length} migrations.`);
