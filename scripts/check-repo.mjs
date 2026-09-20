import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDashboard } from '../packages/core/semantics.ts';
const root=fileURLToPath(new URL('../',import.meta.url));
const read=p=>readFile(path.join(root,p),'utf8');
const manifest=JSON.parse(await read('package.json'));
assert.equal(Object.keys(manifest.dependencies??{}).length,0,'Bootstrap must not gain unreviewed runtime dependencies');
const lock=JSON.parse(await read('package-lock.json'));
for(const [key,p]of Object.entries(lock.packages)){
 if(!key)continue;
 assert.equal(key,'node_modules/typescript','Review dependency inventory before changing this explicit bootstrap allowlist');
 assert.equal(p.version,manifest.devDependencies.typescript);
 assert.equal(p.license,'Apache-2.0');assert.match(p.integrity,/^sha512-/);
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
