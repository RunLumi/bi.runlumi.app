import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const checker=path.join(root,'scripts/check-boundaries.mjs');
// The repository currently passes; this test proves the gate is not vacuous by
// running it against a synthetic tree that violates each rule.
test('boundary gate rejects a core import of an application',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'lumi-boundary-'));
 try{
  await mkdir(path.join(dir,'packages/core/src'),{recursive:true});
  await mkdir(path.join(dir,'scripts'),{recursive:true});
  await writeFile(path.join(dir,'packages/core/package.json'),JSON.stringify({name:'@runlumi/core',version:'0.1.0'}));
  await writeFile(path.join(dir,'scripts/check-boundaries.mjs'),'');
  await writeFile(path.join(dir,'packages/core/src/bad.ts'),"import {x} from '../../../apps/api/src/api.ts';\n");
  const run=spawnSync(process.execPath,[checker],{cwd:dir,encoding:'utf8',env:{...process.env,LUMI_BOUNDARY_ROOT:dir}});
  assert.notEqual(run.status,0,'A core file importing an application must fail the gate');
  assert.match(run.stderr+run.stdout,/imports an application/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('boundary gate rejects server modules in the browser bundle',async()=>{
 const dir=await mkdtemp(path.join(tmpdir(),'lumi-boundary-'));
 try{
  await mkdir(path.join(dir,'packages/ui/src'),{recursive:true});
  await writeFile(path.join(dir,'packages/ui/package.json'),JSON.stringify({name:'@runlumi/ui',version:'0.1.0'}));
  await writeFile(path.join(dir,'packages/ui/src/bad.tsx'),"import {createApi} from '@runlumi/core/api.ts';\n");
  const run=spawnSync(process.execPath,[checker],{cwd:dir,encoding:'utf8',env:{...process.env,LUMI_BOUNDARY_ROOT:dir}});
  assert.notEqual(run.status,0,'A browser file importing the server API must fail the gate');
  assert.match(run.stderr+run.stdout,/server-only module/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
