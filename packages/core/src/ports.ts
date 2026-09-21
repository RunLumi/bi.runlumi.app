export interface DbResult<T=Record<string,unknown>>{success:boolean;results:T[];meta:{changes?:number;rows_read?:number;duration?:number}}
export interface Statement{bind(...values:(string|number|null)[]):Statement;first<T=Record<string,unknown>>():Promise<T|null>;all<T=Record<string,unknown>>():Promise<DbResult<T>>;run():Promise<DbResult>}
export interface Database{withSession?(constraint:string):Database;prepare(sql:string):Statement;batch(statements:Statement[]):Promise<DbResult[]>}
export interface ObjectStore{get(key:string):Promise<{text():Promise<string>;size?:number}|null>;put(key:string,value:string,options?:{httpMetadata?:{contentType:string}}):Promise<unknown>}
export interface AppEnv{DB?:Database;SOURCES:ObjectStore;ASSETS?:{fetch(request:Request):Promise<Response>};[binding:string]:unknown}
