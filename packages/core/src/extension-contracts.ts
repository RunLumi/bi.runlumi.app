import {AppError,text} from './contracts.ts';

/** Product modules that a reviewed application composition may enable. */
export const CORE_MODULES=['commerce','operations','ai'] as const;
export type CoreModule=typeof CORE_MODULES[number];

/** Advisory response to a deterministic finding. Rules never execute side effects. */
export interface DecisionRule {
  id:string;
  when:{detectorId:string; minSeverity:'low'|'medium'|'high'};
  then:{label:string; suggestedOwnerRole:'owner'|'editor'};
  externalAction:false;
}

const RULE_ID=/^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)*$/;

/** Validate a bounded catalog. An empty catalog is a valid application choice. */
export function parseDecisionRules(value:unknown):DecisionRule[]{
 if(!Array.isArray(value)||value.length>50)throw new AppError(422,'INVALID_DECISION_RULES');
 const seen=new Set<string>();
 return value.map(raw=>{
  if(!raw||typeof raw!=='object'||Array.isArray(raw))throw new AppError(422,'INVALID_DECISION_RULE');
  const r=raw as Record<string,unknown>;
  if(Object.keys(r).some(k=>!['id','when','then','externalAction'].includes(k)))throw new AppError(422,'UNKNOWN_DECISION_RULE_FIELD');
  const id=String(r.id);
  if(!RULE_ID.test(id)||id.length>95||seen.has(id))throw new AppError(422,'INVALID_DECISION_RULE_ID');
  seen.add(id);
  const when=r.when as Record<string,unknown>|undefined;
  if(!when||typeof when!=='object'||Array.isArray(when)||Object.keys(when).some(k=>!['detectorId','minSeverity'].includes(k)))throw new AppError(422,'INVALID_DECISION_RULE_CONDITION');
  const detectorId=text(when.detectorId,64);
  const minSeverity=String(when.minSeverity);
  if(minSeverity!=='low'&&minSeverity!=='medium'&&minSeverity!=='high')throw new AppError(422,'INVALID_MIN_SEVERITY');
  const thenClause=r.then as Record<string,unknown>|undefined;
  if(!thenClause||typeof thenClause!=='object'||Array.isArray(thenClause)||Object.keys(thenClause).some(k=>!['label','suggestedOwnerRole'].includes(k)))throw new AppError(422,'INVALID_DECISION_RULE_RESPONSE');
  const label=text(thenClause.label,120);
  const suggestedOwnerRole=String(thenClause.suggestedOwnerRole);
  if(suggestedOwnerRole!=='owner'&&suggestedOwnerRole!=='editor')throw new AppError(422,'INVALID_SUGGESTED_ROLE');
  if(r.externalAction!==false)throw new AppError(422,'EXTERNAL_ACTION_NOT_ALLOWED');
  return {id,when:{detectorId,minSeverity},then:{label,suggestedOwnerRole},externalAction:false};
 });
}
