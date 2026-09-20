# PR #2 — commerce foundation upgrade and acceptance record

Scope: central metadata authority, configuration delivery, semantic serving and
merchant-facing foundation. This PR does not attempt to deliver all 28 commerce
specifications. Code and synthetic fixtures are not live source certification.

## Review findings fixed

1. Control deployment was omitted and CONTROL_DB migration used the cell config.
   Runbook now migrates both planes and deploys private control before cells.
2. Clean-checkout demo referenced absent React output. Setup installs both locked
   graphs; predev builds assets; direct harness invocation gives an actionable error.
3. Missing frontend lock allowed transitive drift. Lock is committed, CI uses only
   npm ci, blocks high/critical advisories and checks package-specific licenses.
4. Mobile table/grid children expanded the page. Containment is on components,
   not page overflow hiding; all main views are checked at 320/390/768/1280px.
5. Enabled AI references were syntax-only. Target-tenant registry ownership and
   revocation now gate registration, activation and reads; inference remains off.
6. Concurrent conflicting registrations could return an opaque database error.
   First commit wins immutably; replays converge and different content conflicts.
7. A one-dashboard lookup could return unrelated Git dashboards. Resource lookup
   is now exact and Git assets receive the appropriate revision ETag.
8. Dashboard authoring could reference pack-excluded metrics. Server validates
   both create/update definitions and every query against the active allowlist.
9. Multi-widget queries were separate requests. A bounded query-batch now uses one
   authorization/configuration context and one transactional D1 batch. The client
   validates response count, tenant, context hash and release revision.
10. Source coverage was only a caveat. Responses now distinguish absent publication,
    missing registered source and watermarks behind the requested period. No source
    is marked complete merely because transport succeeded.
11. Routing lacked an epoch fence. Additive migrations add control/data identity
    epochs; admission and activation reject stale routes. Fleet migration automation
    and cancellation of already-admitted operations are still not implemented.

## Contract-to-evidence mapping

| Owner | Implemented subset | Remaining boundary |
|---|---|---|
| C01 | current principal/membership/entitlements, central metadata-only service, tenant DB identity, route-epoch admission, operator vs owner | scoped finance/PII/row permissions, signed leases, fleet cutover/orchestration |
| C10 | bounded static semantic plans; one evaluation context per query-batch; prepared SQL; row/byte/window caps; no-store | joins, commerce ASTs, query admission fairness, historical retained versions |
| C14 | real operations fixture: capacity distinct from recorded cash savings | no order/package/returns canonical facts or live operations connector |
| C18 | Vietnamese decision-product readiness, working cost pack, explicit absent capabilities, responsive error/empty states | commerce drill-down, investigation queue, visual canvas |
| C20 | strict declarative packs, tenant-owned enabled AI refs, private R2 hash, immutable source-commit registration, revision/epoch activation, UI/Git boundary | no GitHub attestation, dependency DAG/compiler, finance review, tenant-local release metadata or cross-schema rollback |
| C22 | negative tenant/role/ref tests, no raw SQL/key/endpoints, private no-store API, no implicit operator facts | no customer-grade key broker, retention/export/AI egress flows, live security audit |
| C23 | separate generated control/cell bindings; additive migrations; local read-batch semantics | Wrangler/workerd/D1/R2/Access/restore/load certification remains mandatory |
| C24 | persisted plan feature entitlement windows, explicit grace/suspension, audited revision update | invoice collection, metering and customer billing not implemented |
| C26 | executable SQLite/WebCrypto/regression/browser/lock/commerce-oracle gates | synthetic evidence is not merchant reconciliation or production certification |

Acceptance coverage is **partial**, not all IDs passed. In particular C20-A06
cross-data-schema rollback and C01-A04 two-cell migration cannot be claimed from
parser or route-epoch unit tests alone. C10-A03 is tested for the supported operations
snapshot model, not a universal transactional view of upstream ecommerce systems.

## UX and strategy

Home is an honest decision-product landing surface: Money Truth, Stock Decisions,
Operations Exceptions, source readiness and Ask Lumi status. No fabricated sales,
profit, stock, connector login, AI chat or ROI claims are added. The existing useful
operations-cost dashboard lives under `/operations` and remains clearly synthetic
in the local harness. Data health is separated from capability availability.

## Next release gate

One approved merchant source and one closed settlement period, canonical order
identity without OMS/marketplace double counting, three merchant-confirmed metrics,
and one resolved discrepancy. Source access and reconciliation evidence—not adding
more menu items—earn the next commerce capability.

## Validation

See [VALIDATION.md](../VALIDATION.md) for actual local/CI evidence and exclusions.
This PR does not provision Cloudflare resources, issue customer licenses, connect
merchant accounts, change repository license, or modify the brand system.
