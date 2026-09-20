/** Narrow structural ports. Real Cloudflare bindings satisfy these interfaces. */
export interface DbResult<T = Record<string, unknown>> { success: boolean; results: T[]; meta: { changes?: number; rows_read?: number; duration?: number } }
export interface Statement {
  bind(...values: (string|number|null)[]): Statement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<DbResult<T>>;
  run(): Promise<DbResult>;
}
export interface Database { prepare(sql: string): Statement; batch(statements: Statement[]): Promise<DbResult[]> }
export interface ObjectStore { put(key: string, value: string, options?: {httpMetadata?: {contentType:string}}): Promise<unknown> }
export interface Env {
  CONTROL_DB: Database;
  SOURCES: ObjectStore;
  ASSETS: {fetch(request: Request): Promise<Response>};
  TENANT_BINDINGS: string;
  CELL_ID: string;
  ACCESS_TEAM: string;
  ACCESS_AUD: string;
  [key: string]: unknown;
}
