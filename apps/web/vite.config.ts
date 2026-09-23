import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import {fileURLToPath,URL} from 'node:url';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
const appRoot=dirname(fileURLToPath(import.meta.url));
const repoRoot=join(appRoot,'../..');
const version=(JSON.parse(readFileSync(join(repoRoot,'package.json'),'utf8')) as {version:string}).version;
const buildTime=new Date().toISOString();
let gitHash='';
try{
 gitHash=execFileSync('git',['rev-parse','--short=12','HEAD'],{cwd:repoRoot,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 if(execFileSync('git',['status','--porcelain'],{cwd:repoRoot,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim())gitHash+='-dirty';
}catch{/* Git metadata may not be present in packaged builds. */}

export default defineConfig({plugins:[react(),tailwindcss()],define:{__LUMI_BUILD_VERSION__:JSON.stringify(version),__LUMI_BUILD_TIME__:JSON.stringify(buildTime),__LUMI_GIT_HASH__:JSON.stringify(gitHash)},resolve:{alias:[{find:'@lumi/tailwind',replacement:fileURLToPath(new URL('../../tailwind.css',import.meta.url))},{find:'@',replacement:fileURLToPath(new URL('./src',import.meta.url))}],dedupe:['react','react-dom']},
  server:{port:5173,strictPort:true,host:'127.0.0.1',proxy:{'/api':{target:'http://127.0.0.1:8787',changeOrigin:false}}},
  build:{target:'es2022',sourcemap:false,chunkSizeWarningLimit:600}});
