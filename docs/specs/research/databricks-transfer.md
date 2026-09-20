# Databricks lessons, compressed into a commerce product

Status: architectural recommendation grounded in the official references [D1–D6](sources.md). Not a claim Lumi implements Databricks features or shares its transaction guarantees.

## What to borrow

| Principle | Minimal Lumi implementation | Why a merchant cares | Explicit non-goal |
|---|---|---|---|
| Bronze / Silver / Gold | Raw provider envelopes in R2; canonical revisions; published serving aggregates | A wrong number can be replayed and explained | A distributed compute platform |
| Reliable table/data versions | Immutable publication manifests plus staged facts and atomic tenant pointer | One dashboard uses one known context and can be reproduced | Pretend R2+D1 has Delta Lake transactions |
| Governed catalog | Versioned metric/model registry with owner, scope, source and lifecycle | 'Lãi' means the same thing in a chart and Ask Lumi | Full Unity Catalog clone |
| Lineage and impact | Source→canonical→metric→query→answer/action edges | A changed fee mapping identifies affected decisions | Universal automatic lineage over arbitrary user code |
| Expectations | Named quality predicates, quarantine, coverage and release gates | Missing orders/costs do not become confident profit | Drop bad rows silently to improve success metrics |
| Curated natural-language BI | Approved semantic tools, examples, ambiguity rules and exact claim verification | Vietnamese questions get bounded, traceable answers | Unrestricted text-to-SQL as the product |
| Managed ingestion/jobs | Capability adapters, durable receipts, overlap polling, retry/replay and backfill budgets | Sources stay trustworthy despite retries and schema drift | Hundreds of thin connectors with no reconciliation |
| Separate authoring from serving | Git/UI drafts compile into immutable releases; bounded query marts | Customization does not disrupt daily operations | Customer code executing in a shared privileged Worker |
| Model lifecycle governance | Versioned route/prompt/evals, tenant egress policy, rollback | Model upgrades do not quietly change data exposure or numbers | A general model-training platform |
| Secure sharing | Scope-aware APIs/exports/embeds with revocation and retention | Partners see only the merchant data they are granted | Global cross-customer data access by default |

## Where the analogy breaks

Databricks serves a broad data/AI platform audience. Lumi's initial buyer wants a reconciled payout, a stock decision or fewer manual operations—not a workspace full of notebooks. The product should hide the data-engineering machinery while preserving inspectable evidence.

Bronze/Silver/Gold describes data responsibilities, not necessarily three storage technologies or separate clusters. P0 may keep compact canonical and aggregate data in the same tenant D1 while retaining distinct schemas/contracts and publication versions. R2 is the archive, not a database transaction coordinator. Tenant database separation is not equivalent to comprehensive catalog/IAM isolation.

A central catalog must not become a central unrestricted copy of customer data. Keep tenant definitions/overrides and permissions explicit. Shared metric packs reuse business logic, not private merchant facts. Raw marketplace and OMS records are observations of overlapping business events; a warehouse does not solve their identity and accounting semantics automatically.

## Three implementation tests for the transfer

1. **Replay:** ingest duplicate/out-of-order source events, fix a mapping, republish and reproduce both previous retained and corrected result contexts.
2. **One definition:** render a dashboard, answer a Vietnamese question and prepare an agent proposal from the same governed metric version; all numerical claims match.
3. **Impact and authority:** a fee-source defect downgrades contribution, marks affected answers/proposals stale, and exposes evidence only to authorized users.

These tests capture more merchant value than adopting a complex table format or adding a notebook UI before the first sale.

## Design decision

Build a narrow commerce data operating system with governed semantic contracts and clear storage exits. Adopt mature engines/libraries where they lower measured cost/risk. Do not let 'Lumi Databricks' become permission for platform breadth without a paid decision loop.
