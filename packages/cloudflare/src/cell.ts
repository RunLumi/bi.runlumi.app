import type {AppEnv, Database, ObjectStore, ServiceBinding} from '@runlumi/core/ports.ts';
/** Cell (shared multi-tenant Worker) environment: routing, static assets and Access config. */
export interface Env extends AppEnv { ASSETS: {fetch(request: Request): Promise<Response>}; ACCESS_TEAM: string; ACCESS_AUD: string }
/** Assembly shared by the reference cell Worker and dedicated customer Workers.
 * Worker-first: data APIs authenticate before assets are ever served. Static
 * shell responses contain no customer data; asset protection is enforced by
 * `run_worker_first` configuration plus Access on the hostname. */
export function createCellWorker({api}:{api:(request:Request,env:Env)=>Promise<Response>}) {
  return async(request:Request,env:Env):Promise<Response>=>{
    const path=new URL(request.url).pathname;
    if(path.startsWith('/api/')||path==='/healthz')return api(request,env);
    // Static shell contains no customer data. All data APIs are authenticated independently.
    return env.ASSETS.fetch(request);
  };
}
export type {AppEnv, Database, ObjectStore, ServiceBinding};
