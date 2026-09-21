/** Build a customer application from installed @runlumi packages.
 * Deterministic and offline by default: no registry fetch, no core source paths and
 * no npm subprocesses - tsc and vite run from their installed binaries via node,
 * so npm's release-age guards and config parsing never touch the build. */
import {spawnSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const repoRoot=path.resolve(root,'..');
const require=createRequire(import.meta.url);
const run=(command,args,cwd=repoRoot)=>{
 const result=spawnSync(command,args,{cwd,stdio:'inherit'});
 if(result.status!==0)process.exit(result.status??1);
};
// Resolve the installed toolchain binaries from this repository's node_modules.
// The package.json bin field is read through the exports map, so neither tsc nor
// vite CLI subpaths need to be exported themselves.
const toolBin=async pkgId=>{
 const pkgRoot=path.dirname(require.resolve(`${pkgId}/package.json`));
 const bin=JSON.parse(await readFile(path.join(pkgRoot,'package.json'),'utf8')).bin;
 const entry=typeof bin==='string'?bin:Object.values(bin)[0];
 return path.join(pkgRoot,entry);
};
const tsc=await toolBin('typescript');
const vite=await toolBin('vite');
// 1. Validate configuration before building anything.
run(process.execPath,['--experimental-strip-types',path.join(root,'validate.mjs')]);
// 2. Typecheck the whole application against package declarations.
run(process.execPath,[tsc,'--noEmit'],path.join(repoRoot,'apps/web'));
// 3. Build the browser bundle.
run(process.execPath,[vite,'build'],path.join(repoRoot,'apps/web'));
const manifest=JSON.parse(await readFile(path.join(repoRoot,'lumi.lock.json'),'utf8'));
console.log(`Built customer application for ${manifest.customerId} against core ${manifest.core.version}.`);
