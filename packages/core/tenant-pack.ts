import {AppError,id,object,text} from './contracts.ts';
import {getMetric,parseDashboard,parseQuery,type Dashboard} from './semantics.ts';
export interface TenantPack {
  schemaVersion:1; semanticVersion:'operations-v1'; name:string;
  allowedMetrics:string[];
  dashboards:{id:string;definition:Dashboard}[];
  queries:{id:string;metrics:string[];groupBy:'none'|'day'|'workflow'}[];
  ai:{enabled:boolean;providerInstanceRef:string;modelRef:string;credentialRef:string;
      dailyBudgetUsd:number;contextMode:'authorized-results-only';prompt:string};
}
function unique<T>(items:T[],key:(item:T)=>string):T[]{if(new Set(items.map(key)).size!==items.length)throw new AppError(400,'PACK_DUPLICATE_ID');return items;}
export function parseTenantPack(value:unknown):TenantPack {
  if(value===undefined)throw new AppError(400,'PACK_REQUIRED');
  if(new TextEncoder().encode(JSON.stringify(value)).byteLength>48_000)throw new AppError(413,'PACK_TOO_LARGE');
  const v=object(value,['schemaVersion','semanticVersion','name','allowedMetrics','dashboards','queries','ai']);
  if(v.schemaVersion!==1||v.semanticVersion!=='operations-v1')throw new AppError(400,'PACK_VERSION_UNSUPPORTED');
  if(!Array.isArray(v.allowedMetrics)||!v.allowedMetrics.length||v.allowedMetrics.length>7)throw new AppError(400,'PACK_METRICS_REQUIRED');
  const allowedMetrics=unique(v.allowedMetrics.map(x=>getMetric(text(x,64)).id),x=>x);
  if(!Array.isArray(v.dashboards)||!v.dashboards.length||v.dashboards.length>12||!Array.isArray(v.queries)||v.queries.length>20)throw new AppError(400,'PACK_LIMIT');
  const dashboards=unique(v.dashboards.map(x=>{const d=object(x,['id','definition']);return {id:id(d.id),definition:parseDashboard(d.definition)};}),x=>x.id);
  for(const d of dashboards)for(const w of d.definition.widgets)if(w.metrics.some(m=>!allowedMetrics.includes(m)))throw new AppError(400,'PACK_METRIC_DENIED');
  const queries=unique(v.queries.map(x=>{const q=object(x,['id','metrics','groupBy']);const valid=parseQuery({metrics:q.metrics,groupBy:q.groupBy,from:'2026-01-01',to:'2026-01-02'});if(valid.metrics.some(m=>!allowedMetrics.includes(m)))throw new AppError(400,'PACK_METRIC_DENIED');return {id:id(q.id),metrics:valid.metrics,groupBy:valid.groupBy};}),x=>x.id);
  const a=object(v.ai,['enabled','providerInstanceRef','modelRef','credentialRef','dailyBudgetUsd','contextMode','prompt']);
  if(typeof a.enabled!=='boolean'||a.contextMode!=='authorized-results-only'||typeof a.dailyBudgetUsd!=='number'||!Number.isFinite(a.dailyBudgetUsd)||a.dailyBudgetUsd<=0||a.dailyBudgetUsd>100)throw new AppError(400,'PACK_AI_POLICY');
  if(typeof a.prompt!=='string'||a.prompt.length>6000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(a.prompt))throw new AppError(400,'PACK_PROMPT');
  return {schemaVersion:1,semanticVersion:'operations-v1',name:text(v.name,100),allowedMetrics,dashboards,queries,
    ai:{enabled:a.enabled,providerInstanceRef:id(a.providerInstanceRef),modelRef:id(a.modelRef),credentialRef:id(a.credentialRef),dailyBudgetUsd:a.dailyBudgetUsd,contextMode:'authorized-results-only',prompt:a.prompt}};
}
export interface ActivePack {releaseId:string;revision:number;sourceCommit:string;provenance:'operator-asserted';attestationVerified:false;pack:TenantPack}
