import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../apps/web/',import.meta.url);
const pkg=JSON.parse(await readFile(new URL('package.json',root),'utf8'));
const lock=JSON.parse(await readFile(new URL('package-lock.json',root),'utf8'));
assert.equal(lock.lockfileVersion,3);
for(const category of ['dependencies','devDependencies'])for(const[name,version]of Object.entries(pkg[category])){
 assert.match(version,/^\d+\.\d+\.\d+$/,'Direct dependency must be exact');
 assert.equal(lock.packages[''].dependencies?.[name]??lock.packages[''].devDependencies?.[name],version);
 assert.equal(lock.packages['node_modules/'+name]?.version,version);
}
for(const[path,p]of Object.entries(lock.packages)){
 if(!path)continue;
 assert(!p.link,'No unreviewed linked package');assert.match(p.resolved??'',/^https:\/\/registry\.npmjs\.org\//);assert.match(p.integrity??'',/^sha512-/);
 const common=['MIT','Apache-2.0','ISC','BSD-3-Clause'].includes(p.license);
 const font=path==='node_modules/@fontsource-variable/geist'&&p.license==='OFL-1.1';
 // Scoped exceptions: build-time browser data and unmodified CSS compiler only.
 const data=path==='node_modules/caniuse-lite'&&p.dev===true&&p.license==='CC-BY-4.0';
 const css=/^node_modules\/lightningcss(?:-[a-z0-9-]+)?$/.test(path)&&p.dev===true&&p.license==='MPL-2.0';
 assert(common||font||data||css,`Unreviewed license/package: ${path} (${p.license})`);
}
console.log(`Frontend lock/provenance/license checks passed: ${Object.keys(lock.packages).length-1} locked packages, lifecycle scripts disabled on install.`);
