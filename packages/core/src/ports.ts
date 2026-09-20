/** Narrow structural ports. Real Cloudflare bindings satisfy these interfaces.
 * Core application services depend on these ports, never on a specific runtime. */
import type {ActivePack} from './tenant-pack.ts';
import type {Feature} from './licensing.ts';
import type {Principal,Role} from './contracts.ts';
export interface DbResult<T = Record<string, unknown>> { success: boolean; results: T[]; meta: { changes?: number; rows_read?: number; duration?: number } }
export interface Statement {
  bind(...values: (string|number|null)[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<DbResult<T>>;
  run(): Promise<DbResult>;
}
export interface Database { withSession?(constraint: string): Database; prepare(sql: string): Statement; batch(statements: Statement[]): Promise<DbResult[]> }
export interface ObjectStore { get(key:string): Promise<{text():Promise<string>;size?:number}|null>; put(key: string, value: string, options?: {httpMetadata?: {contentType:string}}): Promise<unknown> }
/** Private service binding to the central control plane (membership/license/route authority). */
export interface ServiceBinding { fetch(request: Request): Promise<Response> }
/** Cell/deployment routing environment. Dedicated customer deployments set CUSTOMER_ID. */
export interface CellRoutingEnv { CONTROL: ServiceBinding; TENANT_BINDINGS: string; CELL_ID: string; CUSTOMER_ID?: string; [binding: string]: unknown }
/** Environment required by the application API: routing plus the source object store. */
export interface AppEnv extends CellRoutingEnv { SOURCES: ObjectStore }
export interface TenantContext {id:string;role:Role;db:Database;principal:Principal;active:ActivePack|null;features:Feature[];routeEpoch:number}
