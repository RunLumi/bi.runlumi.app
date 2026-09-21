import test from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {writeFile, readFile, mkdir, rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));

/** Fake wrangler: emulates enough of `wrangler d1 execute` for the migration
 * runner's boundaries. State (ledger rows, tables, executed files) persists in
 * a JSON file so scenarios are deterministic. */
const FAKE_WRANGLER=`#!/usr/bin/env node
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
const statePath=process.env.FAKE_STATE;
const state=existsSync(statePath)?JSON.parse(readFileSync(statePath,'utf8')):{ledger:{},tables:[],executedFiles:[],failLedgerRead:false,corruptLedgerJson:false};
const args=process.argv.slice(2);
const commandIndex=args.indexOf('--command');
const fileIndex=args.indexOf('--file');
if(fileIndex>=0){const file=args[fileIndex+1];state.executedFiles.push(file);writeFileSync(statePath,JSON.stringify(state));process.exit(0);}
if(commandIndex>=0){
 const command=args[commandIndex+1];
 if(/SELECT name,checksum FROM schema_migrations/.test(command)){
  if(state.failLedgerRead){console.error('X_D1_ERROR: no such database');process.exit(1);}
  if(state.corruptLedgerJson){console.log('this is not json');process.exit(0);}
  if(!state.tables.includes('schema_migrations')){console.error('X_D1_ERROR: no such table: schema_migrations');process.exit(1);}
  console.log(JSON.stringify([{results:Object.entries(state.ledger).map(([name,checksum])=>({name,checksum}))}]));
  process.exit(0);
 }
 if(/SELECT name FROM sqlite_master/.test(command)){
  console.log(JSON.stringify([{results:state.tables.filter(t=>['installation','users','commerce_receipts'].includes(t)).map(name=>({name}))}]));
  process.exit(0);
 }
 if(/^INSERT INTO schema_migrations/.test(command)){
  const name=/'([^']+)'/.exec(command)?.[1];const checksum=/'([a-f0-9]{64})'/.exec(command)?.[1];
  if(name)state.ledger[name]=checksum??'';
  writeFileSync(statePath,JSON.stringify(state));process.exit(0);
 }
 if(/^CREATE TABLE IF NOT EXISTS schema_migrations/.test(command)){
  if(!state.tables.includes('schema_migrations'))state.tables.push('schema_migrations');
  writeFileSync(statePath,JSON.stringify(state));process.exit(0);
 }
 process.exit(0);
}
process.exit(0);
`;

async function scenario(name,fakeEnv={}){
 const dir=path.join(root,'tests','.migrate-fixture',name);
 await rm(dir,{recursive:true,force:true});
 await mkdir(path.join(dir,'scripts'),{recursive:true});
 await mkdir(path.join(dir,'apps','worker'),{recursive:true});
 await mkdir(path.join(dir,'customer','migrations'),{recursive:true});
 await mkdir(path.join(dir,'node_modules','@runlumi','core','migrations','installation'),{recursive:true});
 // Two core migrations and one customer migration, mirroring the real layout.
 await writeFile(path.join(dir,'node_modules','@runlumi','core','migrations','installation','0001_initial.sql'),'CREATE TABLE installation(id TEXT);\n');
 await writeFile(path.join(dir,'node_modules','@runlumi','core','migrations','installation','0002_more.sql'),'CREATE TABLE evidence(id TEXT);\n');
 await writeFile(path.join(dir,'customer','migrations','0001_customer.sql'),'CREATE TABLE customer_extra(id TEXT);\n');
 await writeFile(path.join(dir,'apps','worker','wrangler.jsonc'),'{}');
 const statePath=path.join(dir,'state.json');
 await writeFile(statePath,JSON.stringify(fakeEnv.state??{ledger:{},tables:fakeEnv.tables??[],executedFiles:[],...Object.fromEntries(Object.entries(fakeEnv).filter(([k])=>['failLedgerRead','corruptLedgerJson'].includes(k)))}));
 const script=await readFile(path.join(root,'starter','customer','scripts','migrate.mjs'),'utf8');
 await writeFile(path.join(dir,'scripts','migrate.mjs'),script);
 // Fake wrangler written executable with a node shebang so direct spawn works.
 await writeFile(path.join(dir,'fake-wrangler.mjs'),FAKE_WRANGLER,{mode:0o755});
 const run=(extraArgs=[])=>spawnSync(process.execPath,[path.join(dir,'scripts','migrate.mjs'),...extraArgs],{cwd:dir,encoding:'utf8',env:{...process.env,LUMI_WRANGLER_BIN:path.join(dir,'fake-wrangler.mjs'),FAKE_STATE:statePath}});
 return {dir,run,statePath,readState:async()=>JSON.parse(await readFile(statePath,'utf8'))};
}

test('fresh install applies all migrations in order and records them after execution',async()=>{
 const s=await scenario('fresh');
 const r=s.run();
 assert.equal(r.status,0,r.stderr||r.stdout);
 const state=await s.readState();
 assert.equal(state.executedFiles.length,3,'all three files executed');
 const recorded=Object.keys(state.ledger);
 assert.equal(recorded.length,3);
 assert.ok(state.executedFiles[0].includes('0001_initial.sql'),'core migrations run first');
 // Repeat invocation: everything applied and unchanged, nothing re-executed.
 const before=(await s.readState()).executedFiles.length;
 const again=s.run();
 assert.equal(again.status,0);
 assert.match(again.stdout,/All 3 migrations are applied and unchanged/);
 assert.equal((await s.readState()).executedFiles.length,before,'no file re-executed');
});

test('a changed applied migration is refused; applied history with a missing file is refused',async()=>{
 const s=await scenario('changed');
 let r=s.run();assert.equal(r.status,0);
 // Change an applied file on disk.
 await writeFile(path.join(s.dir,'customer','migrations','0001_customer.sql'),'CREATE TABLE customer_extra(id TEXT);\n-- tampered\n');
 r=s.run();
 assert.equal(r.status,1);
 assert.match(r.stderr,/changed on disk/);
 // Missing applied history: ledger knows a file the tree no longer has.
 const s2=await scenario('missing',{state:{ledger:{'core/0009_deleted.sql':'a'.repeat(64)},tables:['schema_migrations','installation','users','commerce_receipts'],executedFiles:[]}});
 r=s2.run();
 assert.equal(r.status,1);
 assert.match(r.stderr,/no longer present/);
});

test('a ledger read or parse failure refuses to run; it is never treated as a fresh database',async()=>{
 const failing=await scenario('ledger-error',{failLedgerRead:true});
 let r=failing.run();
 assert.equal(r.status,1);
 assert.match(r.stderr,/Cannot read the migration ledger/);
 const corrupt=await scenario('ledger-corrupt',{corruptLedgerJson:true});
 r=corrupt.run();
 assert.equal(r.status,1);
 assert.match(r.stderr,/not valid JSON/);
 // Neither run may have executed any migration file.
 assert.equal((await failing.readState()).executedFiles.length,0);
 assert.equal((await corrupt.readState()).executedFiles.length,0);
});

test('--adopt verifies a compatible schema and never executes files; refusal on fresh databases',async()=>{
 const fresh=await scenario('adopt-fresh',{tables:['schema_migrations']});
 let r=fresh.run(['--adopt']);
 assert.equal(r.status,1);
 assert.match(r.stderr,/no compatible existing schema/);
 assert.equal((await fresh.readState()).executedFiles.length,0);
 const existing=await scenario('adopt-existing',{tables:['schema_migrations','installation','users','commerce_receipts']});
 r=existing.run(['--adopt']);
 assert.equal(r.status,0,r.stderr);
 const state=await existing.readState();
 assert.equal(state.executedFiles.length,0,'adopt must not execute SQL');
 assert.equal(Object.keys(state.ledger).length,3);
});
