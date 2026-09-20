import {createServer} from 'node:http';
import {readFile,access} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {resolve,sep} from 'node:path';
import {fixture} from './local-adapters.mjs';
const webRoot=fileURLToPath(new URL('../apps/web/dist/',import.meta.url));
try{await access(new URL('../apps/web/dist/index.html',import.meta.url));}catch{throw new Error('Frontend bundle missing. Run npm run setup, then npm run build:web (or npm run dev).');}
const {api,env,close}=await fixture();
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.woff2':'font/woff2','.mjs':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml'};
const port=8787;
const server=createServer(async(req,res)=>{
 try{
  if(!['localhost:8787','127.0.0.1:8787','localhost:5173','127.0.0.1:5173'].includes(req.headers.host??'')){res.writeHead(403);res.end('Loopback host required');return;}
  const url=new URL(req.url??'/',`http://${req.headers.host}`);
  if(url.pathname.startsWith('/api/') || url.pathname==='/healthz'){
   let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>65536){res.writeHead(413);res.end('Body too large');return;}chunks.push(chunk);}
   const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(typeof v==='string')headers.set(k,v);
   if(!headers.has('x-demo-user'))headers.set('x-demo-user','alpha-owner');
   const method=req.method??'GET';const request=new Request(url,{method,headers,...(!['GET','HEAD'].includes(method)?{body:Buffer.concat(chunks)}:{})});
   const response=await api(request,env);res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  const path=resolve(webRoot,`.${decodeURIComponent(!url.pathname.split('/').at(-1).includes('.')?'/index.html':url.pathname)}`);
  if(!path.startsWith(webRoot.endsWith(sep)?webRoot:webRoot+sep)){res.writeHead(403);res.end();return;}
  const type=Object.entries(mime).find(([ext])=>path.endsWith(ext))?.[1];
  if(!type){res.writeHead(404);res.end();return;}
  const data=await readFile(path);res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(data);
 }catch(error){res.writeHead(500);res.end('Local development error');console.error(error.message);}
});
server.listen(port,'127.0.0.1',()=>console.log(`Lumi BI demo: http://localhost:${port}\nSynthetic data only. Loopback-only. Production entry never imports this authentication adapter.`));
process.on('SIGINT',()=>server.close(()=>{close();process.exit(0);}));
