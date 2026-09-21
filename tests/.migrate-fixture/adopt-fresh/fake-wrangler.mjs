#!/usr/bin/env node
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
