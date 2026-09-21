# 9. Publish, query and use reports and decisions

Commerce numbers are only readable from a **published report**: an immutable,
checksummed artifact assembled from reviewed normalizations and stored with
full provenance. Raw receipts never feed queries directly.

## The publish flow (owner)

1. **Commerce** page: select the normalized builds that belong to the same
   reporting window.
2. **Duyệt xem trước** (preview) — the server assembles the report and returns
   a preview hash. Review the metrics and warnings.
3. **Công bố** (publish) — succeeds only against the same head revision and
   preview hash (`PUBLICATION_PREVIEW_REQUIRED` otherwise). Publication
   advances the head revision, links its inputs immutably, and marks receipts
   published.

The publish step enforces monotonicity: a newer publication cannot use an
older observation (`SOURCE_OBSERVATION_REGRESSION`) and cannot silently omit a
previously published source (`PUBLICATION_SOURCE_OMISSION`). Cross-source
objects require reviewed identity links (`CROSS_SOURCE_IDENTITY_REVIEW_REQUIRED`).

## What the numbers mean

- Metrics are exact integers in VND minor units (BigInt end-to-end); ratios
  carry 6 decimals with half-away-from-zero rounding.
- Missing cost/fee/stock coverage yields **null**, never 0, and surfaces as a
  warning (`MISSING_HISTORICAL_COGS`, `MISSING_VARIABLE_FEES`,
  `MISSING_AVAILABLE_STOCK`, …).
- `contribution_pre_ads` requires cost AND fee coverage; otherwise null.
- Settlement metrics distinguish expected (`expected_settlement`), observed
  cash (`observed_cash_received`) and the gap (`unreconciled_payout_amount`).
  The gap is not recovered cash; `recorded_recovery` stays 0 until a decision
  is resolved with outcome evidence.
- Inventory uses the latest physical gauge per pool; advertised stock is
  excluded and counted as a warning.

Every published report carries these limitations in its own payload and in the
**Bản công bố** screen.

## Query and export

- **Bản công bố** renders the active publication read-only.
- `POST /api/commerce/queries` runs typed, versioned metric queries pinned to a
  publication id with `consistency:"published"`; viewers may query a subset of
  metrics, owners everything (`COMMERCE_FIELD_DENIED` otherwise).
- Exports: CSV (BOM-prefixed, formula-injection-safe) or JSON, both embedding
  the publication id and content hash: **Commerce** page links or
  `GET /api/commerce/publications/<id>/export?format=csv|json`. Exports are
  owner-authorized and blocked when the underlying sources were revoked.

## Operational queries

Operations metrics (cases, released hours, costs) run on
`POST /api/query` / `/api/query-batch` over active snapshots. Every result
carries a snapshot context hash, provenance and a quality state
(`NO_PUBLISHED_DATA`, `MISSING_SOURCE`, `BEHIND_REQUESTED_PERIOD`) so a
dashboard can never mix snapshots silently.

## Questions (curated, deterministic)

`POST /api/commerce/ask` answers a narrow set of questions (recognized sales,
recognized order count) by matching phrases to reviewed metrics — a
**deterministic curated path**, explicitly labelled `mode:"curated-deterministic"`,
`llmInvolved:false` in every response. It is not an LLM, cannot discuss profit
without cost coverage, and executes nothing. There is no conversational report
editing; reports are edited in Git by developers.

## Saved reports

**Báo cáo** saves a query definition bound to a publication; each run stores
its result with the publication hash, so a saved report is reproducible
evidence. Refresh re-runs against the current head. **Đề xuất báo cáo TSX**
returns a reviewed React source proposal for a customer report — it is never
written or executed automatically.

## Findings and decisions

**Quyết định** lists observed findings on the active publication (missing
cost/fees, negative contribution, payout gaps, non-positive stock). Opening a
decision pins the publication as its evidence. Transitions are guarded
(OPEN → INVESTIGATING → AWAITING_OUTCOME → RESOLVED/ACCEPTED_LIMITATION) with
revision checks, and RESOLVED requires a **new publication** in which the
condition actually cleared (`OUTCOME_NOT_OBSERVED`). Findings never trigger
autonomous actions.

Continue to [Customize pages, reports and server behavior](10-customize.md).
