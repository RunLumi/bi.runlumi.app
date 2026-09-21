import {DatabaseSync} from 'node:sqlite';
import type {Database,DbResult,ObjectStore,Statement} from '@runlumi/core/ports.ts';

export class LocalDatabase implements Database {
  db=new DatabaseSync(':memory:');
  private pending:Promise<unknown>=Promise.resolve();
  prepare(sql:string):Statement{const self=this;const wrap=(params:(string|number|null)[]=[]):Statement=>({bind(...values:(string|number|null)[]){return wrap(values)},async first<T=Record<string,unknown>>(){const result=await this.all<T>();return result.results[0]??null},async all<T=Record<string,unknown>>():Promise<DbResult<T>>{const statement=self.db.prepare(sql);const rows=statement.columns().length?statement.all(...params) as T[]:null;if(rows!==null)return {success:true,results:rows,meta:{changes:0}};const result=statement.run(...params);return {success:true,results:[],meta:{changes:Number(result.changes)}}},async run(){return this.all()}});return wrap()}
  batch(statements:Statement[]):Promise<DbResult[]>{const run=async()=>{this.db.exec('BEGIN');try{const results:DbResult[]=[];for(const statement of statements)results.push(await statement.all());this.db.exec('COMMIT');return results}catch(error){this.db.exec('ROLLBACK');throw error}};const execution=this.pending.then(run);this.pending=execution.catch(()=>{});return execution as Promise<DbResult[]>}
  close(){this.db.close()}
  exec(sql:string){this.db.exec(sql)}
  raw(){return this.db}
}
export class LocalObjects implements ObjectStore {objects=new Map<string,string>();async put(key:string,value:string){this.objects.set(key,value);return {key}}async get(key:string){const value=this.objects.get(key);return value===undefined?null:{text:async()=>value}}}
