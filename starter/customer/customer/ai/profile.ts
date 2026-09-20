/** Customer AI profile. This selects interpretation and presentation only.
 * Prompts may change how results are explained; they can never change deterministic
 * finance rules or permission boundaries, and they never supply SQL. Inference is
 * not enabled by this file: it is a reviewed configuration reference. */
export interface AiProfile {
  providerInstanceRef: string;
  modelRef: string;
  credentialRef: string;
  dailyBudgetUsd: number;
  contextMode: 'authorized-results-only';
  prompts: { id: string; file: string }[];
}

export const aiProfile:AiProfile={
 providerInstanceRef:'replace-provider-instance',
 modelRef:'replace-model-alias',
 credentialRef:'replace-credential-ref',
 dailyBudgetUsd:5,
 contextMode:'authorized-results-only',
 prompts:[{id:'explain-metric',file:'prompts/explain-metric.txt'}]
};
