import assert from 'node:assert/strict';
import {readdir, readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
// Static enforcement of the core/customization boundary. Folder naming and
// CODEOWNERS are not sufficient: dependency direction is checked mechanically.
const root=process.env.LUMI_BOUNDARY_ROOT?path.resolve(process.env.LUMI_BOUNDARY_ROOT):fileURLToPath(new URL('../',import.meta.url));
const SKIP=new Set(['node_modules','dist','.git','artifacts','test-results','playwright-report','validation-artifacts','.wrangler','.generated','.local']);
async function sources(relativeDir){
 const base=path.join(root,relativeDir);const files=[];
 async function walk(dir){
  let entries;try{entries=await readdir(dir,{withFileTypes:true});}catch{return;}
  for(const entry of entries){
   if(entry.name.startsWith('.')||SKIP.has(entry.name))continue;
   const full=path.join(dir,entry.name);
   if(entry.isDirectory())await walk(full);
   else if(/\.(ts|tsx|mjs|js)$/.test(entry.name))files.push(full);
  }
 }
 await walk(base);
 return files;
}
const specifiers=source=>{
 const found=[];
 for(const match of source.matchAll(/(?:from\s*|import\s*\(\s*)['"]([^'"]+)['"]/g))found.push(match[1]);
 return found;
};
/** Browser code (React/Vite) must never pull server-only modules into a bundle. */
const SERVER_ONLY=['@runlumi/core/api.ts','@runlumi/core/ports.ts','@runlumi/core/ingest.ts','@runlumi/core/query.ts','@runlumi/cloudflare/auth.ts','@runlumi/cloudflare/testing.ts'];
const failures=[];
const check=(condition,message)=>{if(!condition)failures.push(message);};
const isExternal=spec=>spec.startsWith('@runlumi/')||(!spec.startsWith('.')&&!spec.startsWith('node:'));
// 1. Core and cloudflare packages never depend on an application, the UI, or a customer.
for(const dir of ['packages/core/src','packages/cloudflare/src']){
 for(const file of await sources(dir)){
  const rel=path.relative(root,file);const source=await readFile(file,'utf8');
  for(const spec of specifiers(source)){
   const resolved=spec.startsWith('.')?path.resolve(path.dirname(file),spec):spec;
   check(!/^apps\//.test(spec)&&!/(?:^|\/)apps\//.test(resolved),`${rel} imports an application: ${spec}`);
   check(!spec.startsWith('@runlumi/ui'),`${rel} imports browser UI from core: ${spec}`);
   check(!/customer|examples\//.test(spec),`${rel} imports customer-specific code: ${spec}`);
  }
 }
}
// 2. Browser UI must not import server-only modules or node builtins.
for(const file of await sources('packages/ui/src')){
 const rel=path.relative(root,file);const source=await readFile(file,'utf8');
 for(const spec of specifiers(source)){
  check(!SERVER_ONLY.includes(spec),`${rel} pulls server-only module into the browser bundle: ${spec}`);
  check(!spec.startsWith('node:'),`${rel} imports a node builtin into the browser bundle: ${spec}`);
  check(!spec.startsWith('apps/')&&!/^\.\.\/(\.\.\/)*apps\//.test(spec),`${rel} imports application code: ${spec}`);
 }
}
// 3. The production entry never imports the local test adapter.
for(const entry of ['apps/api/src/index.ts']){
 let source;try{source=await readFile(path.join(root,entry),'utf8');}catch{continue;}
 for(const spec of specifiers(source)){
  check(!spec.includes('testing.ts'),`${entry} must not import the local test adapter: ${spec}`);
  check(!spec.includes('local-adapters'),`${entry} must not import the local fixture adapter: ${spec}`);
 }
}
// 4. No file may deep-import another package's src/ or dist/ via a relative path;
// cross-package imports must use the declared @runlumi/* package specifier.
const ownerPackage=file=>{
 const match=/(?:^|\/)packages\/([a-z0-9-]+)\//.exec(path.relative(root,file));
 return match?match[1]:null;
};
for(const file of [...await sources('apps'),...await sources('packages'),...await sources('scripts')]){
 const rel=path.relative(root,file);const source=await readFile(file,'utf8');const owner=ownerPackage(file);
 for(const spec of specifiers(source)){
  if(!spec.startsWith('.'))continue;
  const resolved=path.resolve(path.dirname(file),spec);
  const target=/(?:^|\/)packages\/([a-z0-9-]+)\/(src|dist)\//.exec(resolved);
  if(!target)continue;
  check(target[1]===owner,`${rel} deep-imports another package's internal (use @runlumi/${target[1]}/...): ${spec}`);
 }
}
// 5. The typecheck-only root must not treat a workspace package as external at runtime.
for(const file of await sources('packages/core/src')){
 const source=await readFile(file,'utf8');
 for(const spec of specifiers(source)){
  check(!(isExternal(spec)&&/^@runlumi\/(cloudflare|ui)/.test(spec)),`${path.relative(root,file)} has an upward dependency: ${spec}`);
 }
}
assert.deepEqual(failures,[],`Dependency boundary violations:\n - ${failures.join('\n - ')}`);
console.log('Dependency boundaries enforced: no application imports in core, no server modules in browser bundles, no package deep imports, no upward dependencies.');
