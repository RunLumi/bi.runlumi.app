/** Customer decision workflows. A workflow records a supported, human-reviewed
 * response to an observed finding. It never executes external actions: lumi-agents
 * owns action authority and verification. Customer workflows may not bypass core
 * permission or audit handling. */
export interface DecisionRule {
  id: string;
  /** Observed condition this rule reacts to, from core findings. */
  when: {detectorId:string; minSeverity:'low'|'medium'|'high'};
  /** Suggested human response. Not an executed action. */
  then: {label:string; suggestedOwnerRole:'owner'|'editor'};
  externalAction: false;
}

export const decisionRules:readonly DecisionRule[]=[
 {id:'customer.review-negative-stock',when:{detectorId:'NEGATIVE_STOCK',minSeverity:'medium'},then:{label:'Rà soát tồn kho âm theo cửa hàng',suggestedOwnerRole:'owner'},externalAction:false}
];
