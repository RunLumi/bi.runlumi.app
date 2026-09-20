import {readFile,realpath,lstat,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';import {pathToFileURL} from 'node:url';
import {parseTenantPack} from '@runlumi/core/tenant-pack.ts';
/** Compile declarative JSON + a referenced UTF-8 prompt. Never execute tenant code. */
export async function compilePack(directory){
 const root=await realpath(directory);
 async function read(relative){
  if(typeof relative!=='string'||!relative||path.isAbsolute(relative)||relative.split(/[\\/]/).includes('..'))throw new Error('Unsafe pack path');
  const target=path.resolve(root,relative);const real=await realpath(target);
  if(!real.startsWith(root+path.sep)||(await lstat(target)).isSymbolicLink())throw new Error('Pack path escapes root');
  const stat=await lstat(real);if(!stat.isFile()||stat.size>48000)throw new Error('Pack file limit');return readFile(real,'utf8');
 }
 const source=JSON.parse(await read('pack.json'));
 if(source.ai&&'promptFile' in source.ai){const prompt=await read(source.ai.promptFile);delete source.ai.promptFile;source.ai.prompt=prompt;}
 return parseTenantPack(source);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 try{if(process.argv.length!==4)throw new Error('Usage: npm run pack:build -- tenant-pack-directory output.json');const pack=await compilePack(process.argv[2]);await mkdir(path.dirname(process.argv[3]),{recursive:true});await writeFile(process.argv[3],JSON.stringify(pack,null,2)+'\n');console.log('Validated bundle created. No publish, activation, model call or deployment performed.');}catch(error){console.error(error.message);process.exitCode=1;}
}
