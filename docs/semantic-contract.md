# Semantic contract v0.1

Status: the narrow `operations-v1` contract is implemented. Arbitrary customer
models, finance schemas and joins are planned rather than silently supported.

## Dataset and grain

`workflow_facts` is one aggregate per **source + workflow + business day** within
an immutable source snapshot. One source snapshot replaces the previous published
snapshot for that source; it is not an incremental append. Record IDs and natural
grains must be unique within a snapshot.

Different registered sources must own disjoint facts. Registration is an operator
review, not an endpoint exposed to a model. Combining overlapping source aggregates
would double count. A future source identity/dedup model must be designed before
merging CRM, ERP and spreadsheet representations of the same business event.

The import cap is 20 aggregate rows, not 20 original business transactions. Empty
snapshots are rejected. An explicit zero-row/tombstone publication protocol is a
future task, not represented by deleting historical facts.

## Fields

| Field | Meaning |
| --- | --- |
| `day` | Normalized business date, Asia/Ho_Chi_Minh in this pack |
| `cases` | Completed cases represented by the aggregate |
| `baselineMinutes` | Baseline human effort for those same cases; not minutes per case |
| `humanMinutes` | Observed residual effort, including review/exceptions where applicable |
| `runtimeCostVnd` | Allocated actual AI/runtime cost for those cases |
| `supportCostVnd` | Allocated recurring support cost, not duplicate whole-company totals |
| `cashSavingsVnd` | Owner-reported actual cash expense removed, with evidence reference |
| `cashEvidenceRef` | Opaque reference, not embedded evidence or a secret URL |

Current money representation is integer VND, with no FX conversion. Minutes and
cases are nonnegative bounded integers; derived released effort may be negative.
The baseline's measurement method and comparability require review outside this
bootstrap. The code does not claim a causal experiment or audit the evidence file.

## Metric dictionary

Definitions live in `packages/core/semantics.ts`. Public catalog excludes SQL
expressions. Definitions are code-reviewed and expose a version.

- `cases`: sum of represented cases.
- `baseline_hours`: summed baseline minutes / 60.
- `human_hours`: summed residual human minutes / 60.
- `released_hours`: (baseline minus residual human minutes) / 60; capacity only.
- `runtime_cost_vnd`: sum of allocated runtime costs.
- `cash_savings_vnd`: sum of documented, owner-reported cash expense removed.
- `net_cash_benefit_vnd`: cash savings minus runtime and allocated support costs.

Capacity value, avoided future hiring and realized cash need separate reporting.
No positive actual savings means no actual cash payback claim. `cashPayback`
returns null when net monthly cash benefit is nonpositive.

## Query contract

```json
{
  "metrics": ["cases", "released_hours", "net_cash_benefit_vnd"],
  "groupBy": "workflow",
  "from": "2026-09-01",
  "to": "2026-10-01"
}
```

Filters use `[from, to)` dates. Maximum span 93 days. Dimensions are `none`, `day`
or `workflow`; metrics are reviewed IDs only. Unknown fields, metrics, SQL or
expressions are rejected. Identifiers come from a trusted registry and filter
values become SQL parameters. Output is bounded to 200 rows.

A response includes tenant ID, definition version, requested date window,
reporting timezone, source watermark, snapshot ID, checksum and ingestion time.
`generatedAt` is not source freshness. `rowsRead` is null where the local adapter
cannot measure it; no invented performance telemetry.

## Missing data is not zero

SQL aggregate counts are returned as `matched_rows`. A KPI with no published
snapshot or no matching fact is displayed as unavailable rather than zero. Zero
is shown only when matching observations genuinely sum to zero.

Source watermark means the source reported observation coverage through that date;
it does not prove every required source or event is complete. The bootstrap cannot
automatically certify completeness, freshness SLA or current-period comparability.
Add explicit freshness/completeness states before shipping alerting or forecasts.

## Dashboard contract

One dashboard has schemaVersion 1, title, and 1-12 widgets. Each widget has id,
kind, title, metric IDs and groupBy. KPI, bar and table have strict compatibility
rules. No SQL, HTML, script, executable path or credential is accepted in config.

Editor/owner may create definitions; existing edits require `If-Match` revision.
A stale revision conflicts instead of silently overwriting another editor.
Tenant data is not included in the shared dashboard pack.

Each query atomically reads data and lineage. Client rendering verifies equal
snapshot fingerprints across cards before showing a whole dashboard. This
prevents showing one card before and another after a concurrent publication.

## Future model admission

Before enabling custom metrics, add schema versioning, owner review, grain and
join-cardinality tests, dimension ACLs, restricted expression AST, metric dependencies,
unit propagation, null semantics, parameterized compilation and query budgets.
Names that sound alike are not automatically the same metric. "Revenue" in two
customer ERPs requires business agreement, not an LLM guess.
