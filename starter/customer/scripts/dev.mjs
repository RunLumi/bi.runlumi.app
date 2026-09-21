/** Local synthetic development server. Loopback-only. Uses the same public core
 * interfaces as production with synthetic identity; it never connects to the central
 * control plane and cannot be enabled in a production Worker. */
import {createServer} from 'node:http';
import {readFile, readdir, access} from 'node:fs/promises';
import {createRequire} from 'node:module';
import path from 'node:path';
import process from 'node:process';
import {fileURLToPath} from 'node:url';
import {createApi} from '@runlumi/core/api.ts';
import {LocalDatabase, LocalObjects, AppError, stubControl} from '@runlumi/cloudflare/testing.ts';
import {manifest} from '../customer/manifest.ts';

const repoRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const webRoot=path.join(repoRoot,'apps/web/dist');
const port=Number(process.env.PORT??8788);
const require=createRequire(import.meta.url);

const db=new LocalDatabase();const objects=new LocalObjects();
// Apply the exact tenant migrations vendored inside the installed core package
// (the same SQL a deployment applies), followed by any additive customer-owned
// migrations, then seed the deployment's single tenant identity so routing
// fences agree with the synthetic control stub (route_epoch 1).
const coreRoot=path.resolve(path.dirname(require.resolve('@runlumi/core/api.ts')),'..');
for(const plane of ['tenant']){
 const dir=path.join(coreRoot,'migrations',plane);
 const files=(await readdir(dir)).filter(f=>f.endsWith('.sql')).sort();
 for(const file of files)db.db.exec(await readFile(path.join(dir,file),'utf8'));
}
const customerMigrations=path.join(repoRoot,'customer/migrations');
try{
 const files=(await readdir(customerMigrations)).filter(f=>f.endsWith('.sql')).sort();
 for(const file of files)db.db.exec(await readFile(path.join(customerMigrations,file),'utf8'));
}catch{/* no customer-owned migrations */} 
db.db.prepare('INSERT INTO tenant_identity (singleton,tenant_id) VALUES (1,?)').run(manifest.customerId);
const env={
 SERVING:db,SOURCES:objects,
 CONTROL:{fetch:stubControl({cellId:'local',memberships:[{tenantId:manifest.customerId,issuer:'local-test',subject:'local-owner',role:'owner'}]})},
 CELL_ID:'local',CUSTOMER_ID:manifest.customerId,TENANT_BINDINGS:'["SERVING"]',ACCESS_TEAM:'',ACCESS_AUD:''
};
const authenticate=async request=>({issuer:'local-test',subject:request.headers.get('x-demo-user')??'local-owner'});
const {customMetricExtensions}=await import('../customer/data/server-metrics.ts');
const api=createApi(authenticate,true,{customMetrics:customMetricExtensions});
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=createServer(async(req,res)=>{
 try{
  if(!['localhost','127.0.0.1'].includes((req.headers.host??'').split(':')[0]??'')){res.writeHead(403);res.end('Loopback only');return;}
  const url=new URL(req.url??'/',`http://${req.headers.host}`);
  if(url.pathname.startsWith('/api/')||url.pathname==='/healthz'){
   const headers=new Headers();for(const[k,v]of Object.entries(req.headers))if(typeof v==='string')headers.set(k,v);
   headers.set('x-demo-user',headers.get('x-demo-user')??'local-owner');
   // Forward the exact request body so import/job endpoints work locally with the
   // same bytes production sees; GET/HEAD carry none.
   const body=['GET','HEAD'].includes(req.method??'GET')?undefined:Buffer.from(await new Promise((resolve,reject)=>{const chunks=[];req.on('data',c=>chunks.push(c));req.on('end',()=>resolve(Buffer.concat(chunks)));req.on('error',reject);}));
   const response=await api(new Request(url,{method:req.method,headers,body}),env);
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  // Static assets from the built SPA, with history fallback: any non-file route
  // (and any path whose file does not exist) renders index.html so client-side
  // navigation works like a production deployment.
  const requested=url.pathname==='/'?'index.html':url.pathname.slice(1);
  const target=path.join(webRoot,requested);
  if(!target.startsWith(webRoot)){res.writeHead(403);res.end();return;}
  const type=mime[path.extname(target)];
  let bodyBuffer=null;
  try{bodyBuffer=await readFile(target);}catch{/* fall through to SPA fallback */}
  if(bodyBuffer===null){
   if(type){res.writeHead(404);res.end();return;}
   bodyBuffer=await readFile(path.join(webRoot,'index.html'));
  }
  res.writeHead(200,{'Content-Type':type??mime['.html'],'X-Content-Type-Options':'nosniff','Cache-Control':'no-store'});res.end(bodyBuffer);
 }catch(error){res.writeHead(error instanceof AppError?error.status:500);res.end('Local development error');}
});
server.listen(port,'127.0.0.1',()=>console.log(`Local synthetic demo: http://localhost:${port} (loopback only)`));
