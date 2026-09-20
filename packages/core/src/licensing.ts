import { AppError, object, text } from './contracts.ts';
export const features = ['bi.read','dashboard.edit','data.import','git.publish','ai.analyze'] as const;
export type Feature = typeof features[number];
export interface License {
  plan_id: string; state: 'trial'|'active'|'past_due'|'suspended'|'cancelled';
  starts_at: string; ends_at: string; grace_ends_at: string|null;
  features: string; revision: number;
}
export function timestamp(value: unknown): string {
  const v=text(value,24);
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString()!==v) throw new AppError(400,'INVALID_TIMESTAMP');
  return v;
}
export function parseLicense(value:unknown): Omit<License,'revision'> {
  const v=object(value,['plan_id','state','starts_at','ends_at','grace_ends_at','features']);
  if(!['trial','active','past_due','suspended','cancelled'].includes(String(v.state)))throw new AppError(400,'INVALID_LICENSE');
  if(!Array.isArray(v.features)||v.features.length>features.length||!v.features.every(x=>features.includes(x)))throw new AppError(400,'INVALID_FEATURES');
  if(new Set(v.features).size!==v.features.length)throw new AppError(400,'DUPLICATE_FEATURE');
  const starts_at=timestamp(v.starts_at),ends_at=timestamp(v.ends_at),grace_ends_at=v.grace_ends_at==null?null:timestamp(v.grace_ends_at);
  if(ends_at<=starts_at||(grace_ends_at!==null&&grace_ends_at<ends_at))throw new AppError(400,'INVALID_LICENSE_WINDOW');
  return {plan_id:text(v.plan_id,64),state:v.state as License['state'],starts_at,ends_at,grace_ends_at,features:JSON.stringify(v.features)};
}
export function effectiveFeatures(license:License|null, now=Date.now()): Feature[] {
  if(!license)return [];
  let parsed:Omit<License,'revision'>;
  try {parsed=parseLicense({plan_id:license.plan_id,state:license.state,starts_at:license.starts_at,ends_at:license.ends_at,grace_ends_at:license.grace_ends_at,features:JSON.parse(license.features)});}catch{return [];}
  if(now<Date.parse(parsed.starts_at)||['suspended','cancelled'].includes(parsed.state))return [];
  const allowed=JSON.parse(parsed.features) as Feature[];
  if(['active','trial'].includes(parsed.state)&&now<Date.parse(parsed.ends_at))return allowed;
  // Explicit, time-bounded read-only grace. Never infer grace or allow writes in past_due.
  if(parsed.grace_ends_at&&now<Date.parse(parsed.grace_ends_at))return allowed.filter(x=>x==='bi.read');
  return [];
}
export function requireFeature(license:License|null,feature:Feature,now=Date.now()):void {
  if(!effectiveFeatures(license,now).includes(feature))throw new AppError(403,'ENTITLEMENT_REQUIRED');
}
