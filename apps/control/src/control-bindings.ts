import type {Database} from '@runlumi/core/ports.ts';
export interface PackStore {
  put(key:string,value:string,options?:{httpMetadata?:{contentType:string}}):Promise<unknown>;
  get(key:string):Promise<{size?:number;text():Promise<string>}|null>;
}
export interface ControlEnv {CONTROL_DB:Database;PACKS:PackStore;ACCESS_TEAM:string;ACCESS_AUD:string}
