import type {DecisionRule} from '@runlumi/core/customer-config.ts';

/** Customer decision workflows. A workflow records a supported, human-reviewed
 * response to an observed finding. It never executes external actions: lumi-agents
 * owns action authority and verification. Customer workflows may not bypass core
 * permission or audit handling. */
export const decisionRules:readonly DecisionRule[]=[
 {id:'customer.review-negative-stock',when:{detectorId:'NEGATIVE_STOCK',minSeverity:'medium'},then:{label:'Rà soát tồn kho âm theo cửa hàng',suggestedOwnerRole:'owner'},externalAction:false}
];