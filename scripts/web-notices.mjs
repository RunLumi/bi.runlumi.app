// Copy notices (never execute package scripts) from the exact installed runtime graph.
import {readFile,writeFile,access} from 'node:fs/promises';
const root=new URL('../apps/web/',import.meta.url);
const lock=JSON.parse(await readFile(new URL('package-lock.json',root),'utf8'));
const sections=['Lumi BI — third-party distribution notices. Original Lumi code remains private/reserved.'];
for(const[path,p]of Object.entries(lock.packages)){
 if(!path||p.dev)continue;
 let found;
 for(const name of ['LICENSE','LICENSE.md','LICENSE.txt','license','license.md','LICENSE-MIT']){
  const file=new URL(path+'/'+name,root);try{await access(file);found=await readFile(file,'utf8');break;}catch{}
 }
 if(!found&&path==='node_modules/@radix-ui/react-compose-refs'&&p.license==='MIT'){
  // Same radix-ui/primitives upstream; compose-refs omits the shared WorkOS notice in its tarball.
  found=await readFile(new URL('node_modules/@radix-ui/react-slot/LICENSE',root),'utf8');
 }
 if(!found)throw new Error(`Missing runtime notice for ${path}`);
 sections.push(`\n--- ${path} @ ${p.version} (${p.license}) ---\n${found}`);
}
sections.push(await readFile(new URL('public/licenses/shadcn-ui.txt',root),'utf8'));
await writeFile(new URL('dist/THIRD_PARTY_NOTICES.txt',root),sections.join('\n'));
console.log('Runtime notices included in frontend build.');
