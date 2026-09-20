# C10 — Semantic query serving and execution budgets

Spec: C10 | Status: Target contract | Stage: P0–P3

Owns: authorization-aware plan compilation, execution, result snapshots and cost controls. Excludes: metric meanings (C09), authoring release lifecycle (C20), physical service selection (C23).

## Outcome

Every consumer receives the same authorized number with a reproducible definition and snapshot. One expensive chart or model-generated request cannot scan an entire tenant unbounded or leak another tenant's result cache.

## Query contract

```json
{
  "contract": "lumi.query.v1",
  "metrics": [{"id": "net_merchandise_sales", "version": 1}],
  "dimensions": ["channel"],
  "filters": [{"field": "business_date", "op": "range", "value": ["2026-09-01", "2026-10-01"]}],
  "limit": 100,
  "consistency": "published",
  "dataVersion": "optional-retained-version"
}
```

Tenant/principal/scope is server-derived, not delegated to a model argument. The API may carry a requested tenant route but must authorize it before plan lookup. Proposed field names are a target protocol; no claim the bootstrap supports them yet.

- **C10-R01:** validate metric/version, dimension compatibility, join cardinality, filter operator/type, period, row/byte budget and caller access before compiling SQL. Bind values; identifiers are selected from reviewed catalog, not quoted arbitrary strings.
- **C10-R02:** compile only acyclic approved joins with declared cardinality and fact preaggregation where needed. Joining order lines, shipments and fees directly can fan out and must fail validation or be rewritten deterministically.
- **C10-R03:** resolve one `EvaluationContext` containing tenant route epoch, membership/scope digest, semantic release, data manifest, model version, timezone and currency policy. A multi-widget/dashboard request pins this context for all widgets.
- **C10-R04:** use materialized indexed serving aggregates for common dashboards. Expensive detail or historical scans become cancellable asynchronous query jobs with pagination, progress and bounded output. An LLM cannot bypass this path.
- **C10-R05:** cache only after current authorization. Key includes tenant, scope/policy revision, normalized plan, data manifest, semantic release, currency/timezone and estimation policy. Revoked access is not restored by a cached answer.

## Result envelope

Return query_id, context hash, metric versions, data version, source coverage, source/published timestamps, values+units, quality state/reason codes, scope description, lineage refs, compiled-plan fingerprint, rows/bytes scanned where available and cache state. Suppression/absence differs from zero. Hidden cost columns cannot be reconstructed from returned totals or drill-down metadata.

Do not show a single freshness timestamp when components have different coverage. The publication manifest provides a consistent **known snapshot vector**, not a claim all source systems were globally transactional at the same instant. A requested as-of that cannot be reconstructed returns `AS_OF_UNAVAILABLE`.

## Query classes and safety

P0 predefined semantic plans and bounded drill-down. P1 certified metric authoring and safe expression AST. P2 reviewed SQL templates may be compiled into read-only isolated analytical jobs: parse AST, reject multi-statements/DDL/DML/ATTACH/PRAGMA/extensions, restrict tables/functions, require parameters, row-scope enforcement, cost plan and timeout. Ordinary tenant editors do not gain arbitrary SQL access to a D1 binding. C20 owns the review/publish path.

Bounds are per plan class and cell, measured in staging. Prototype target: indexed dashboard p95 server query ≤1s at the declared load; page load and freshness have separate budgets. This is an internal target, not an SLA. Query timeouts, approximate results and sampled answers must be explicit states. No hidden LIMIT truncation presented as a full total.

## Acceptance

- **C10-A01:** forged tenant/source/table/identifier fails before database execution; prepared values containing SQL syntax remain data.
- **C10-A02:** order→two lines→two shipments→two fees fixture produces the expected total, not an eightfold fanout.
- **C10-A03:** change the active publication during a dashboard request; every widget retains the pinned context or the whole request retries/fails consistently.
- **C10-A04:** identical question from different row/column scopes cannot reuse a privileged result cache or AI answer.
- **C10-A05:** an unbounded detail/LLM request is rejected or moved to a capped job; unrelated tenant queries remain within their budget.
- **C10-A06:** missing/stale source returns an explicit quality state rather than silently consulting raw tables or another tenant.
- **C10-A07:** replaying a retained query context returns the same result unless retention/deletion policy explicitly revoked the data, in which case explain unavailability.
