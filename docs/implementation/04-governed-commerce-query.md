# Implementation 04 — governed commerce query contract

Status: executable bounded query path; merchant and Cloudflare certification pending.
Canonical owners: [C09 metrics](../specs/commerce/09-semantic-metric-contract.md) and
[C10 query serving](../specs/commerce/10-query-serving-and-budgets.md).

## Implemented boundary

`GET /api/tenants/{tenant}/commerce-metrics` returns the code-owned versioned
catalog. `POST /api/tenants/{tenant}/commerce-query` accepts `lumi.query.v1` with
reviewed metric IDs, no dimensions, at most one business-date range filter, limit
`1`, published consistency and an explicit retained `dataVersion`.

The query reuses the existing owner-authorized publication reader. It reads one
immutable report context, verifies its source approval and checksum, and returns
exact decimal-string values, metric units, quality warnings, tenant scope and
publication lineage. It never reads raw tables, compiles SQL from request data,
falls back to an older publication, or treats null as zero. The active publication
is the only accepted data version in this bounded slice.

This is deliberately not the full C10 contract: dimensions, field/row scopes,
viewer access to finance fields, asynchronous detail jobs, cache reuse, fair-share
admission and general metric authoring remain open. No Ask Lumi consumer is wired
to this endpoint yet.

## Executable evidence

`tests/commerce-query.test.mjs` runs the parser, catalog and report adapter through
the real local API boundary. It covers exact string/null values, unknown or
injection-shaped metric IDs, duplicate metrics, dimensions, unsupported filters,
unbounded limits, stale publication IDs, absent data, cache headers and a
cross-tenant request. Together with the publication tests it proves the query
cannot bypass source revocation or publication integrity checks.

Local verification on Node 22.16.0:

```text
npm test       # 219 tests passed
npm run typecheck
```

The result is synthetic export evidence. It does not certify provider fidelity,
merchant reconciliation, field-level finance policy, workerd behavior, load
budgets, or production deployment.

## Next boundary

Add a separate reviewed metric catalog/release record and permission-scoped query
execution only after the owner publication contract is stable. Then connect the
same result envelope to the first curated Ask Lumi question set; do not add
text-to-SQL or infer missing metrics.
