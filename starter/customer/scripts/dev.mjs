/** Local synthetic development server. Loopback-only. Uses the same public core
 * interfaces as production with synthetic identity; it never connects to the central
 * control plane and cannot be enabled in a production Worker. */
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {createApi} from '@runlumi/core/api.ts';
import {LocalDatabase, LocalObjects, AppError, stubControl} from '@runlumi/cloudflare/testing.ts';
import {manifest} from '../../../customer/manifest.ts';

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const webRoot=path.join(repoRoot,'apps/web/dist');
const port=Number(process.env.PORT??8788);

const db=new LocalDatabase();const objects=new LocalObjects();
const env={
 SERVING:db,SOURCES:objects,
 CONTROL:{fetch:stubControl({cellId:'local',memberships:[{tenantId:manifest.customerId,issuer:'local-synthetic',subject:'local-owner',role:'owner'}]})},
 CELL_ID:'local',CUSTOMER_ID:manifest.customerId,TENANT_BINDINGS:'["SERVING"]',ACCESS_TEAM:'',ACCESS_AUD:''
};
const authenticate=async request=>({issuer:'local-synthetic',subject:request.headers.get('x-demo-user')??'local-owner'});
const api=createApi(authenticate,true);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  if(!['localhost','127.0.0.1'].includes((req.headers.host??'').split(':')[0]??'')){res.writeHead(403);res.end('Loopback only');return;}
  const url=new URL(req.url??'/',`http://${req.headers.host}`);
  if(url.pathname.startsWith('/api/')||url.pathname==='/healthz'){
   const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(typeof v==='string')headers.set(k,v);
   headers.set('x-demo-user',headers.get('x-demo-user')??'local-owner');
   const response=await api(new Request(url,{method:req.method,headers}),env);
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  const target=path.join(webRoot,url.pathname==='/'?'index.html':url.pathname);
  if(!target.startsWith(webRoot)){res.writeHead(403);res.end();return;}
  const type=mime[path.extname(target)];
  if(!type){res.writeHead(404);res.end();return;}
  res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(await readFile(target));
 }catch(error){res.writeHead(error instanceof AppError?error.status:500);res.end('Local development error');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local synthetic demo: http://localhost:${port} (loopback only)`));
