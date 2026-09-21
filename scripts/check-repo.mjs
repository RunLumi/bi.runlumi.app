import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDashboard } from '@runlumi/core/semantics.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFile(path.join(root,p),'utf8');
const manifest=JSON.parse(await read('package.json'));
assert.equal(Object.keys(manifest.dependencies??{}).length,0,'Bootstrap must not gain unreviewed runtime dependencies');
assert.deepEqual(manifest.workspaces,['packages/*'],'The product core lives in reviewed workspace packages');
const lock=JSON.parse(await read('package-lock.json'));
for(const key of ['node_modules/typescript','node_modules/@types/node','node_modules/wrangler']){
 assert.equal(lock.packages[key].version,manifest.devDependencies[key.replace('node_modules/','')]);
 assert.match(lock.packages[key].integrity,/^sha512-/);
}
// Root direct dependencies stay a reviewed toolchain: types, TypeScript and the
// pinned local workerd driver. Nothing here ships in a Worker or browser bundle.
const rootManifest=lock.packages[''];
assert.deepEqual(rootManifest.dependencies??{},{} ,'Root package must not declare runtime dependencies');
assert.deepEqual(Object.keys(rootManifest.devDependencies??{}).sort(),['@types/node','typescript','wrangler']);
// Every locked root entry (except workspace links) must come from the registry
// with SHA-512 integrity, and carry a reviewed license. Wrangler's optional
// native image binaries are LGPL-licensed, optional, dev-only and never installed
// into a distributed artifact; they are admitted here by name, not by waiver.
for(const [key,p]of Object.entries(lock.packages)){
 if(!key||key.startsWith('node_modules/@runlumi/')||key.startsWith('packages/'))continue;
 assert.match(p.resolved??'',/^https:\/\/registry\.npmjs\.org\//,`Unreviewed origin: ${key}`);
 assert.match(p.integrity??'',/^sha512-/,`Missing integrity: ${key}`);
 const optionalLgpl=p.optional===true&&p.dev===true&&/^node_modules\/@img\/sharp-/.test(key);
 const common=['MIT','Apache-2.0','ISC','BSD-3-Clause','BSD-2-Clause','0BSD','CC0-1.0','CC-BY-4.0','MIT OR Apache-2.0','Apache-2.0 AND MIT'].includes(p.license);
 assert(common||optionalLgpl,`Unreviewed license/package: ${key} (${p.license})`);
}
for(const workspace of ['packages/core','packages/cloudflare','packages/ui']){
 const pkg=JSON.parse(await read(`${workspace}/package.json`));
 assert.equal(pkg.private,true,`${workspace} must not be registry-publishable without explicit owner approval`);
 assert.equal(pkg.license,'Elastic-2.0',`${workspace} must retain the product license`);
 assert.equal(pkg.version,manifest.version,'Initial core packages share one coordinated release version');
 assert.ok(pkg.files.includes('dist'),`${workspace} ships only built output`);
 assert.ok(pkg.exports['./*.ts'],`${workspace} exposes the source-style specifier used by consumers`);
}
parseDashboard(JSON.parse(await read('packs/operations-cost/dashboard.json')));
const production=await read('apps/api/src/index.ts');
assert(!/x-demo-user|local-adapters|fixtures\/|DEV_AUTH|DEMO_AUTH/.test(production));
const headers=await read('apps/web/public/_headers');assert(headers.includes("frame-ancestors 'none'"));assert(headers.includes("script-src 'self'"));
for(const file of ['README.md','AGENTS.md','SECURITY.md','docs/architecture.md','docs/deployment.md','docs/semantic-contract.md','docs/roadmap.md','docs/references.md']) assert((await read(file)).length>100);
// Check local Markdown targets without fetching external URLs. Code fences are excluded.
async function walk(dir){const list=[];for(const e of await readdir(dir,{withFileTypes:true})){if(e.name.startsWith('.')||['node_modules','dist','validation-artifacts'].includes(e.name))continue;const p=path.join(dir,e.name);if(e.isDirectory())list.push(...await walk(p));else if(p.endsWith('.md')&&!['DESIGN.md','ICON.md'].includes(e.name))list.push(p);}return list;}
for(const file of await walk(root)){
 const source=(await readFile(file,'utf8')).replace(/```[\s\S]*?```/g,'');
 for(const match of source.matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)){
  const link=match[1].split('#')[0];if(!link||/^[a-z]+:/i.test(link))continue;
  const target=path.resolve(path.dirname(file),decodeURIComponent(link));assert(target.startsWith(root),`Link escapes root: ${file}`);
  await readFile(target).catch(()=>{throw new Error(`Broken local link: ${file} -> ${link}`);});
 }
}
console.log('Repository checks passed: dependency inventory, dashboard contract, production entry, security headers and local documentation links.');
