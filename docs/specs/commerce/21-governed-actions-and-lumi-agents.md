# C21 — Governed action proposals and Lumi Agents handoff

Spec: C21 | Status: Target contract | Stage: P0 recommendations; P1 approved internal drafts; P2 governed external actions

Owns: BI-to-execution boundary, proposal lifecycle and verified outcome attribution. Does not own device/browser automation or reimplement the lumi-agents policy engine.

## Outcome

A finding can become a reviewed, scoped operational response without converting analytical access into permission to move money, change inventory or contact customers. Success is a verified state change and later business outcome, not a tool acknowledgement.

## Action levels

- L0: analysis and recommendation only. P0 default.
- L1: create an internal draft/work item for an authorized Lumi user. Still subject to tenant permissions, idempotency and audit.
- L2: hand off a materially specified action to an authorized execution system with explicit approval. Examples: send a supplier request, adjust a replenishment draft, open a platform dispute.
- L3: narrowly pre-authorized recurring low-risk actions under signed policy, live preconditions, expiry and budgets. Not enabled merely because the model performed well in a demo.

Refunds, cancellations, prices, ad budgets, stock quantities, external customer messages, payments and legal consent are not L0/L1. A workflow may remain recommendation-only permanently if consequences cannot be bounded.

## Proposal contract

Target interoperability envelope, to be adapted and version-tested against lumi-agents rather than assumed already compatible:

```json
{
  "contract": "lumi.commerce.action-proposal.v1",
  "proposalId": "opaque",
  "tenantId": "server-derived",
  "decisionId": "opaque",
  "actionKind": "supplier.request-draft",
  "target": {"sourceAccountRef": "approved-ref", "resourceRef": "opaque"},
  "parameters": {},
  "evaluationContext": {"dataVersion": "v1", "semanticRelease": "s1", "queryIds": []},
  "preconditions": [],
  "expectedEffect": {},
  "evidenceRefs": [],
  "idempotencyKey": "opaque",
  "expiresAt": "RFC3339",
  "riskClass": "COMMUNICATION",
  "approvalRequired": true
}
```

No API key, model-generated permission or arbitrary executable program is embedded. Server resolves identity, allowed source account and action schema. A display example cannot be submitted as authorization.

## Contract

- **C21-R01:** a BI insight, query result, alert subscription or Git pack never grants execution authority. The receiving runtime independently authenticates principal/tenant, validates policy and obtains required approval.
- **C21-R02:** approval binds normalized action, target/account, destination, amounts/quantities, evidence/context and expiry. A materially changed action or stale target requires a new decision/approval.
- **C21-R03:** refresh mutable target state immediately before execution. Cancelled order, already-refunded payment, changed stock, revoked token or new tenant route invalidates stale proposals. Snapshot confidence does not replace live preconditions.
- **C21-R04:** the BI read connector and execution credentials are separate capabilities. Do not broaden a BI installation scope merely to make an action demo easy.
- **C21-R05:** persist intent and dispatch receipt before external effects; retries reuse logical identity and inspect ambiguous prior outcomes. Do not replay an uncertain refund/message blindly after a timeout.
- **C21-R06:** display transport acceptance, execution outcome and business outcome separately. `DISPATCHED` is not `VERIFIED_SUCCESS`, and neither proves incremental economic benefit.

## Lifecycle and recovery

`DRAFT → VALIDATED → WAITING_APPROVAL → AUTHORIZED → DISPATCHED → EXECUTION_REPORTED → VERIFYING → VERIFIED_SUCCESS`. Alternate states: REJECTED, EXPIRED, CANCELLED, POLICY_DENIED, FAILED, AMBIGUOUS, SUPERSEDED. Receiving runtime may use different internal states; the adapter maps without discarding uncertainty.

A callback is authenticated, tenant/proposal-bound, replay-protected and idempotent. Include executor action ID, policy/approval reference, target state evidence and observed timestamp. Subsequent BI ingestion confirms the operation in the source system when possible. A human override captures reason and evidence; it cannot retroactively invent successful execution.

Compensation is a new approved action, not a promise every side effect is reversible. Cancellation stops future work and cannot unsend a delivered message. Kill controls exist per tenant, connection, workflow and proposal class.

## Value feedback

Track expected improvement, observed outcome, baseline, time horizon, volume/seasonality controls and confidence class. Verified charge reversal is different from cash received; lowered stockout forecast is not realized recovered sales. C14 owns labor/cash-value categories. P2 controlled experiments can strengthen attribution under C15.

## Acceptance

- **C21-A01:** a viewer can inspect an insight but cannot gain write scope by invoking an action API or modifying a pack.
- **C21-A02:** order refunded after proposal creation: live precondition blocks a second refund.
- **C21-A03:** change destination/quantity/amount after approval: digest validation fails.
- **C21-A04:** dispatch timeout with unknown executor result remains AMBIGUOUS until independently checked; no duplicate send.
- **C21-A05:** forged or cross-tenant callback cannot finalize an action or reveal target data.
- **C21-A06:** successful executor result without source evidence remains awaiting verification/outcome as appropriate.
- **C21-A07:** revoking a connection/tenant stops admission of new actions and expires pending proposals according to policy.
