# C08 — Quality, reconciliation and lineage

Spec: C08 | Status: Target contract | Stage: P0–P3

Owns: evidence of completeness/correctness and lifecycle certification. Excludes: business anomaly detection (C16), transport success (C06), finance-specific matching rules (C12).

## Outcome

A metric can explain which source records it includes, what is missing, how it was checked, and which downstream decisions are affected by a defect. A fresh pipeline must not produce a falsely confident number.

## Contract

- **C08-R01:** track transport health, freshness, authorization coverage, identity mapping coverage, field availability and reconciliation independently. Never compress these into one unexplained confidence score.
- **C08-R02:** every material published dataset carries quality results at source/shop/window/grain. `CERTIFIED`, `PROVISIONAL`, `PARTIAL`, `STALE`, `BLOCKED`, `UNAVAILABLE` are visible states, not colors alone.
- **C08-R03:** raw collection continues when permitted during normalization defects; failed facts are quarantined with reason, owner and replay route. No silent dropping of financially meaningful records.
- **C08-R04:** compare against an independent control when available: source count/list manifest, merchant statement/export, source UI control totals or manually approved sample. Comparing our aggregate to another aggregate built from the same incomplete rows is not independent reconciliation.
- **C08-R05:** certification applies to a definition, source coverage, time window and publication version. It is not a permanent badge for a provider or tenant.

## Reconciliation ladder

1. Transport: receipt and cursor coverage; repeated/missing pages; expected versus actual object IDs.
2. Entity: primary uniqueness, source-to-canonical linkage, parent/child referential coverage and unknown enums.
3. Monetary: order/line component sums, discount allocations, tax basis, refund linkage, settlement signed-entry totals and currency consistency.
4. Inventory: observed pool scopes, snapshots versus movements where history exists, duplicate shared-pool exclusion and impossible quantities requiring investigation.
5. Merchant: selected real orders, closed statements and warehouse figures reviewed with the merchant's existing process.

Store check ID/version, input manifest, expected/actual, absolute difference, denominator, tolerance policy, coverage and source-control ref. A tolerance is not permission to misclassify unexplained differences. Exact arithmetic fixture checks require exact expected equality; operational source comparisons may have documented rounding/timing tolerances and unresolved residues.

## Issue lifecycle

`DETECTED → TRIAGED → ASSIGNED → FIX_IN_PROGRESS → REPLAYED → VERIFIED → CLOSED`, with `ACCEPTED_LIMITATION` as a separately approved state. Deduplicate issues by defect family/source/window. Impact propagation identifies affected metrics, dashboards, AI answers, exports, alerts and action proposals. A resolved upstream defect does not automatically validate already-sent reports.

An incident can retain the last certified publication while displaying that it is stale. If the missing component makes a decision unsafe, block that decision rather than substitute zero. Permission-restricted coverage may be shown as a named subset, never described as a technical outage of a source the user cannot access.

## Lineage contract

Minimal graph: SourceAccount → RawEnvelope/Export → CanonicalRevision → ModelRelease → MetricVersion → QueryExecution → Dashboard/Answer/Decision/ActionProposal. Edges carry transformation version and publication manifest. Impact traversal is permission filtered; metadata about a hidden tenant/customer dataset must not leak via lineage. Column/formula lineage is added where it changes trust, not a decorative graph builder.

This captures useful Databricks governance/expectation ideas without copying its runtime. See [transfer note](../research/databricks-transfer.md).

## Data health UX

Show last source event time (when provided), last successful receipt, last normalized timestamp, published watermark and expected lag separately. Provide a coverage matrix by source, shop, warehouse and resource. Explain why a metric is unavailable and the next action to unlock it, including cost-at-sale upload, fee statement or scope reauthorization.

## Acceptance

- **C08-A01:** omit an entire source page; independent manifest/count reconciliation detects the gap even though all HTTP requests returned 200.
- **C08-A02:** hide one warehouse through token permissions; company-total inventory is partial, not a lower certified number.
- **C08-A03:** a fee schema change quarantines classification and downgrades dependent contribution metrics while sales remains usable.
- **C08-A04:** changing a metric input identifies affected retained answers/reports without exposing inaccessible lineage nodes.
- **C08-A05:** replay a corrected mapping; previous exported report remains reproducible as-known, and latest results are marked restated.
- **C08-A06:** no source control exists: completeness is `UNVERIFIED`, not an invented percentage.
- **C08-A07:** every unresolved material check has an owner/reason; closing a defect requires verification evidence or explicit accepted limitation.
