/** Customer connector extension. Adapters run server-side in the customer Worker
 * under reviewed code; they never expose executable SQL to a browser or model, and
 * they never receive credentials from the browser. This example is a stub that
 * documents the supported contract and is intentionally not a live provider. */
export interface ConnectorPullRequest {connectionId:string;resourceType:'orders'|'settlements'|'inventory';window:{from:string;toExclusive:string};observedAt:string}
export interface ConnectorAdapter {
  provider: string;
  /** Declared resource types this adapter may produce. */
  resources: readonly ('orders'|'settlements'|'inventory')[];
  /** Server-side transport. Must be a supported, certified transport; not arbitrary fetch. */
  transport: 'authorized-export';
  /** Returns a raw export envelope body for the core receipt pipeline. */
  pull(request: ConnectorPullRequest): Promise<unknown>;
}

export const exampleAdapter:ConnectorAdapter={
 provider:'example',
 resources:['orders'],
 transport:'authorized-export',
 async pull(){throw new Error('Example adapter is not certified; configure an approved export source instead.');}
};
