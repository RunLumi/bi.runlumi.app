/** Build a customer application from installed @runlumi packages.
 * Deterministic and offline by default: no registry fetch, no core source paths. */
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(root,'..');
const run=(command,args,cwd=repoRoot)=>{
 const result=spawnSync(command,args,{cwd,stdio:'inherit'});
 if(result.status!==0)process.exit(result.status??1);
};
const resolveNpm=()=>process.env.LUMI_NPM_BIN??'npm';
// 1. Validate configuration before building anything.
run(process.execPath,[path.join(root,'validate.mjs')]);
// 2. Typecheck the whole application against package declarations.
run(resolveNpm(),['exec','--no-install','--','tsc','--noEmit'],path.join(repoRoot,'apps/web'));
// 3. Build the browser bundle.
run(resolveNpm(),['exec','--no-install','--','vite','build'],path.join(repoRoot,'apps/web'));
const manifest=JSON.parse(await readFile(path.join(repoRoot,'lumi.lock.json'),'utf8'));
console.log(`Built customer application for ${manifest.customerId} against core ${manifest.core.version}.`);
