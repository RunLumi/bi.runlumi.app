import type {ConnectorAdapter,ConnectorPullRequest} from '@runlumi/core/api.ts';

/** Customer connector extension. Adapters run server-side in the customer Worker
 * under reviewed code; they never expose executable SQL to a browser or model, and
 * they never receive credentials from the browser. The pull request is always
 * server-constructed from deployment config, never browser-supplied.
 *
 * This example is a deterministic fixture export: the same synthetic source,
 * watermark and day on every pull, so the dev server and the executable customer
 * tests agree on exact metric values. It is intentionally not a live provider. */
export const exampleAdapter:ConnectorAdapter={
 provider:'ops-demo',
 resources:['workflow_facts'],
 transport:'authorized-export',
 async pull(_request:ConnectorPullRequest){
  return {
   sourceId:'ops-demo',
   observedThrough:'2026-09-18',
   records:[{
    recordId:'ops-demo-2026-09-15',
    day:'2026-09-15',
    workflow:'quote-preparation',
    cases:30,
    baselineMinutes:180,
    humanMinutes:30,
    runtimeCostVnd:9000,
    supportCostVnd:4500,
    cashSavingsVnd:0,
    cashEvidenceRef:null
   }]
  };
 }
};