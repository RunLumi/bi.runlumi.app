# C26 — Verification, analytical evals and release evidence

Spec: C26 | Status: Target verification program | Stage: P0 onward

Owns: executable evidence, cross-domain regression and release criteria. Individual acceptance conditions remain in C00–C25. This documentation release is not evidence those product behaviors already pass.

## Evidence levels

1. **Specified:** requirement and example exist.
2. **Fixture verified:** implementation passes deterministic synthetic/approved-redacted fixtures.
3. **Adapter verified:** current official protocol tested under authorized source access.
4. **Merchant reconciled:** a named private signoff records source windows/controls and unresolved differences.
5. **Canary certified:** authenticated Cloudflare deployment, security, load, deletion and recovery tests pass on declared versions.

Keep evidence IDs, date, code/adapter/model release, environment, dataset/fixture hashes, test result and reviewer. A README or a successful demo never advances these levels by itself.

## Contract

- **C26-R01:** each implementation PR references requirement and acceptance IDs plus executable tests. New domain paths include negative authorization tests, not just happy-path chart snapshots.
- **C26-R02:** financial fixture arithmetic is exact. Missing cost, unknown fee class or partial coverage must fail an unqualified profitability claim. No broad percentage tolerance conceals accounting identity errors.
- **C26-R03:** source completeness has a denominator and independent control where available. If independent source coverage is unavailable, report unverified coverage; do not manufacture a 99.99% completeness claim.
- **C26-R04:** release gates cannot be bypassed by removing difficult cases, converting missing facts to zero or weakening tenant checks. Escaped failures become regression fixtures where legally and technically reproducible.
- **C26-R05:** reports separate what was tested locally, in SQLite/workerd, against live providers and on authenticated Cloudflare. Passing a specification checker does not certify runtime or API integration.

## Test portfolio

### Domain and money

Exact money/rounding, currency, null/zero, ratios of sums, status axes, partial returns, multi-shipment/fee fanout, subsidy funding, withholding/reserve, cost-at-sale history, shared stock pools, cohort maturity, source overlap and corrected/closed periods. Include negative quantities, refunds greater than current-period sales and large IDs.

### Ingestion and recovery

Repeated/out-of-order messages; duplicated/short/non-progressing pages; stock-only updates; old-order changes; expired grants; quotas/retry headers; partial backfill; raw-write/receipt/outbox crash windows; schema drift; tombstones; raw replay under new normalizer; publication racing; queue retention expiry; deletion ledger after restore.

### Trust

A→B resource access across query/catalog/cache/lineage/exports/jobs/AI/notifications; row and hidden cost columns; swapped D1 bindings; source callback tenant mismatch; forged grants/cursors; hostile Git configs; SSRF/DNS redirects; source prompt injection; support revocation; sensitive log redaction; action replay and stale approvals.

### Analytical AI

Build at least 100 representative Vietnamese questions before broad Ask Lumi rollout: synonyms/diacritics, ambiguous revenue/profit/cash, missing costs, masked customers, incomplete history, time/cohort comparisons, source contradictions, multi-step decomposition, forbidden access and prompt injection. Label expected interpretation, required query/claim set, permitted limitations and abstention behavior. Keep train/tuning and release cases separate. All displayed financial claims must agree with deterministic results; overall intent/answer quality is evaluated separately with rubric and merchant review. Report abstention and usefulness, not only exact-string match.

### Experience and compatibility

Keyboard/screen-reader paths, data table alternatives, mobile owner flow, stale/partial/empty states, no prior-tenant flash, concurrent edits, mixed publication prevention, changed model/pack/schema, cancelled requests, export formatting and migration/rollback.

## Operational SLO design

Set SLOs only for observable parts Lumi controls and label initial targets as internal. Suggested pilot budgets: indexed dashboard server query p95 ≤1s under the tested load; durable webhook ACK latency p95 ≤2s within provider timeout constraints; published update freshness reported by actual source capability. Use provider timestamps and observed lag where known; do not sell 'real time' for a poll-only source.

Correctness gates: zero unauthorized cross-tenant accesses in test corpus; zero duplicate canonical facts from replay fixtures; exact matched financial fixture sums; no acknowledged-receipt loss in injected failure scenarios; no unsupported numerical AI claims in the release corpus. These are acceptance conditions, not proof of zero real-world incident risk.

Availability/error budgets, percentile traffic distribution and detection windows must be established from canary measurements. A few test runs cannot justify four-nines availability or a statistical performance guarantee.

## Release rings

Internal fixture build → authorized source sandbox → merchant read-only canary → small paid cohort → supported release. Expansion requires a versioned capability/coverage matrix, documented unsupported paths, rollback owner and incident runbooks. Finance write/agentic actions have separate stronger gates and are not bundled with BI read certification.

Connector release evidence includes app/region/grants, tested endpoints, history and timestamp semantics, expected webhook verification, rate behavior, source control totals and scope restrictions. Shopee lacking partner evidence remains blocked even if the rest of the product is ready.

## Mechanical spec artifacts in this change

`../manifest.json` is the owned-domain inventory and delivery dependency DAG. `../fixtures/commerce-golden-cases.json` contains synthetic arithmetic and identity reference cases. `scripts/check-commerce-specs.py` checks the spec index, stable IDs, local links, dependency cycles and those reference expectations. It does **not** execute the production query engine or call vendor APIs. Runtime teams should consume the same fixtures through real adapters/compilers and add provider/security failure tests.

## Acceptance

- **C26-A01:** checker fails for missing spec/ID, broken local reference, duplicate case or dependency cycle.
- **C26-A02:** intentionally wrong basket, duplicate mirrored sale, added stock snapshot or false cash payback fails the synthetic oracle.
- **C26-A03:** live certification artifact cannot be marked complete without authorization/scope evidence and source controls.
- **C26-A04:** a new model/prompt release causing unsupported numbers or weaker abstention fails the analytical gate.
- **C26-A05:** one-tenant restore plus deletion-replay and postcondition validation is demonstrated before a production recovery claim.
- **C26-A06:** delivery report clearly separates specified/fixture/adapter/merchant/canary evidence levels.
