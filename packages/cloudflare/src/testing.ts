import {DatabaseSync} from 'node:sqlite';
import {AppError, type Principal} from '@runlumi/core/contracts.ts';
import type {Database, DbResult, ObjectStore, Statement} from '@runlumi/core/ports.ts';
/** Local semantic test adapter, not a workerd emulator. No network or Cloudflare calls.
 * Test-only: never import this module from production worker or browser entries. */
export class LocalDatabase implements Database {
  private db: DatabaseSync;
  calls = 0;
  private pending: Promise<unknown> = Promise.resolve();
  constructor(){this.db=new DatabaseSync(':memory:');}
  prepare(sql: string): Statement {
    const self=this;
    const wrap=(params: (string|number|null)[]=[]): Statement=>({
      bind(...values: (string|number|null)[]): Statement{return wrap(values);},
      async first<T = Record<string, unknown>>(): Promise<T | null>{const r=await this.all<T>();return r.results[0]??null;},
      async all<T = Record<string, unknown>>(): Promise<DbResult<T>>{
        self.calls++;const stmt=self.db.prepare(sql);const rows=stmt.columns().length?stmt.all(...params) as T[]:null;
        if(rows!==null)return {success:true,results:rows,meta:{changes:0}};
        const result=stmt.run(...params);return {success:true,results:[],meta:{changes:Number(result.changes)}};},
      async run(): Promise<DbResult>{return this.all();}
    });return wrap();
  }
  batch(statements: Statement[]): Promise<DbResult[]>{
    const run=async()=>{
      this.db.exec('BEGIN');
      try{const results: DbResult[]=[];for(const statement of statements)results.push(await statement.all());this.db.exec('COMMIT');return results;}
      catch(error){this.db.exec('ROLLBACK');throw error;}
    };
    // D1 serializes per-database work; our local adapter must not overlap BEGINs.
    const execution=this.pending.then(run);this.pending=execution.catch(()=>{});return execution as Promise<DbResult[]>;
  }
  close(){this.db.close();}
}
export class LocalObjects implements ObjectStore {
  objects=new Map<string,string>();
  async put(key: string, value: string){this.objects.set(key,value);return {key};}
  async get(key: string){const value=this.objects.get(key);return value===undefined?null:{text:async()=>value};}
}
export interface StubMembership {tenantId:string;issuer:string;subject:string;role:'viewer'|'editor'|'owner'}
export interface StubControlConfig {cellId:string;memberships:StubMembership[];features?:string[]}
/** Test-only stand-in for the central control plane. Synthetic memberships only:
 * never real customer data. Production authority stays the deployed control Worker. */
export function stubControl(config:StubControlConfig){
  const features=config.features??['bi.read','dashboard.edit','data.import','git.publish'];
  const members=new Map(config.memberships.map(m=>[`${m.issuer}:${m.subject}:${m.tenantId}`,m]));
  return async(request:Request):Promise<Response>=>{
    const url=new URL(request.url);
    if(url.pathname==='/control/authorize'&&request.method==='POST'){
      const body=await request.json() as {tenantId:string;cellId:string};
      const principal=request.headers.get('x-demo-user')??'';
      const m=members.get(`local-test:${principal}:${body.tenantId}`);
      if(!m||config.cellId!==body.cellId)return Response.json({error:{code:'TENANT_ACCESS_DENIED'}},{status:403});
      return Response.json({id:m.tenantId,role:m.role,binding_name:'SERVING',cell_id:config.cellId,active:null,features,route_epoch:1});
    }
    if(url.pathname==='/control/session'&&request.method==='GET'){
      const principal=request.headers.get('x-demo-user')??'';
      const tenants=config.memberships.filter(m=>m.subject===principal).map(m=>({id:m.tenantId,name:m.tenantId,cell_id:config.cellId,role:m.role}));
      return Response.json({tenants,platformOperator:false});
    }
    return Response.json({error:{code:'NOT_FOUND'}},{status:404});
  };
}
export type {Principal};
export {AppError};
