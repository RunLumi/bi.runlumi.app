import { DatabaseSync } from 'node:sqlite';
import { readFile, readdir } from 'node:fs/promises';
import { createControl } from '../apps/control/src/service.ts';
import { createApi } from '../apps/api/src/api.ts';
import { AppError } from '../packages/core/contracts.ts';
const root=new URL('../',import.meta.url);
/** SQLite semantic test adapter, not a workerd emulator. No network or Cloudflare calls. */
export class LocalDatabase {
  constructor(){this.db=new DatabaseSync(':memory:');this.calls=0;this.pending=Promise.resolve();}
  prepare(sql){
    const self=this;
    const wrap=(params=[])=>({
      bind(...values){return wrap(values);},
      async first(){const r=await this.all();return r.results[0]??null;},
      async all(){self.calls++;const stmt=self.db.prepare(sql);const rows=stmt.columns().length?stmt.all(...params):null;
        if(rows!==null)return {success:true,results:rows,meta:{changes:0}};
        const result=stmt.run(...params);return {success:true,results:[],meta:{changes:Number(result.changes)}};},
      async run(){return this.all();}
    });return wrap();
  }
  batch(statements){
    const run=async()=>{
      this.db.exec('BEGIN');
      try{const results=[];for(const statement of statements)results.push(await statement.all());this.db.exec('COMMIT');return results;}
      catch(error){this.db.exec('ROLLBACK');throw error;}
    };
    // D1 serializes per-database work; our local adapter must not overlap BEGINs.
    const execution=this.pending.then(run);this.pending=execution.catch(()=>{});return execution;
  }
  close(){this.db.close();}
}
export class LocalObjects {
  objects=new Map();
  async put(key,value){this.objects.set(key,value);return {key};}
  async get(key){const value=this.objects.get(key);return value===undefined?null:{text:async()=>value};}
}
export function request(path,{user='alpha-owner',method='GET',body,headers={}}={}){
 return new Request(`http://localhost:8787${path}`,{method,headers:{'x-demo-user':user,...(body!==undefined?{'content-type':'application/json'}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
}
export async function fixture({seed=true}={}){
 const env={CONTROL_DB:new LocalDatabase(),TENANT_A:new LocalDatabase(),TENANT_B:new LocalDatabase(),SOURCES:new LocalObjects(),PACKS:new LocalObjects(),CELL_ID:'local',TENANT_BINDINGS:'["TENANT_A","TENANT_B"]',ACCESS_TEAM:'',ACCESS_AUD:'',ASSETS:{async fetch(){return new Response('fixture',{status:404});}}};
 env.CONTROL_DB.db.exec(await readFile(new URL('migrations/control/0001_initial.sql',root),'utf8'));
 env.CONTROL_DB.db.exec(await readFile(new URL('migrations/control/0002_control_plane.sql',root),'utf8'));
 env.CONTROL_DB.db.exec(await readFile(new URL('migrations/control/0003_release_safety.sql',root),'utf8'));
 env.CONTROL_DB.db.exec(await readFile(new URL('migrations/control/0004_tenant_lifecycle.sql',root),'utf8'));
 const migration=(await Promise.all((await readdir(new URL('migrations/tenant/',root))).filter(f=>f.endsWith('.sql')).sort().map(f=>readFile(new URL('migrations/tenant/'+f,root),'utf8')))).join('\n');
 const dashboard=JSON.parse(await readFile(new URL('packs/operations-cost/dashboard.json',root),'utf8'));
 for(const [tenant,binding,name] of [['alpha','TENANT_A','Doanh nghiệp A · minh họa'],['beta','TENANT_B','Doanh nghiệp B · minh họa']]){
  env.CONTROL_DB.db.prepare("INSERT INTO tenants (id,name,binding_name,cell_id,state) VALUES (?,?,?,'local','active')").run(tenant,name,binding);
  env.CONTROL_DB.db.prepare("INSERT INTO tenant_lifecycle (tenant_id,state,revision,reason,updated_at) VALUES (?,'ACTIVE',1,'local fixture','2026-09-20T00:00:00.000Z')").run(tenant);
  env.CONTROL_DB.db.prepare("INSERT INTO licenses VALUES (?,'pilot','active','2026-01-01T00:00:00.000Z','2099-01-01T00:00:00.000Z',NULL,?,1,'2026-09-20T00:00:00.000Z')").run(tenant,JSON.stringify(['bi.read','dashboard.edit','data.import','git.publish']));
  for(const role of ['owner','editor','viewer'])env.CONTROL_DB.db.prepare("INSERT INTO memberships VALUES (?,'local-demo',?,?,'active')").run(tenant,`${tenant}-${role}`,role);
  const db=env[binding];db.db.exec(migration);
  db.db.prepare('INSERT INTO tenant_identity (singleton,tenant_id) VALUES(1,?)').run(tenant);
  db.db.prepare("INSERT INTO sources VALUES (?,'ops-demo','Synthetic operations snapshot','active')").run(tenant);
  db.db.prepare('INSERT INTO dashboards VALUES (?,?,?,?,?)').run(tenant,'operations-cost',JSON.stringify(dashboard),1,'2026-09-20T00:00:00Z');
 }
 env.CONTROL_DB.db.exec("INSERT INTO users SELECT DISTINCT issuer,subject,'active' FROM memberships; INSERT INTO users VALUES ('local-demo','platform-admin','active'); INSERT INTO platform_operators VALUES ('local-demo','platform-admin');");
 const authenticate=async req=>{
  const user=req.headers.get('x-demo-user');
  if(!user || !/^(?:(alpha|beta)-(owner|editor|viewer)|platform-admin)$/.test(user))throw new AppError(401,'UNAUTHENTICATED');
  return {issuer:'local-demo',subject:user};
 };
 const control=createControl(authenticate);env.CONTROL={fetch:req=>control(req,env)};
 const api=createApi(authenticate,true);
 if(seed)for(const tenant of ['alpha','beta']){
  const body=JSON.parse(await readFile(new URL(`fixtures/${tenant}.json`,root),'utf8'));
  const response=await api(request(`/api/tenants/${tenant}/imports`,{user:`${tenant}-owner`,method:'POST',body,headers:{'idempotency-key':'fixture-first-snapshot'}}),env);
  if(response.status!==201)throw new Error(`Fixture failed: ${await response.text()}`);
 }
 return {env,api,control,dashboard,close(){env.CONTROL_DB.close();env.TENANT_A.close();env.TENANT_B.close();}};
}
