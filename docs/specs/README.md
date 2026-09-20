# Lumi Commerce Intelligence — specification system

Revision: commerce-2026.09 • Reviewed: 2026-09-20 • Language: English contracts, Vietnamese product terminology.

**Product promise:** know which money, stock, and operating exceptions deserve attention; explain the evidence; close the loop on action and outcome.

This is an end-state specification with staged delivery, not a declaration of shipped functionality. The inspected baseline is commit `090d85b3b69a5dd5f929ebf217de4322fb0515f3`: an operations-cost BI bootstrap. Nhanh/Haravan/Shopee connectors, commerce facts, GitOps publishing, Ask Lumi, billing and autonomous actions are not certified by this documentation change.

## Authority and scope

- [AGENTS.md](../../AGENTS.md) remains the engineering/trust contract; [DESIGN.md](../../DESIGN.md) and [ICON.md](../../ICON.md) own brand and visual rules.
- [STRATEGY.md](../../STRATEGY.md) is strategic rationale. Existing architecture/semantic docs describe the bootstrap. This suite defines the **target commerce contracts** and explicitly records migration deltas; it does not silently change deployed behavior.
- A requirement has one canonical owner below. Other specs reference it rather than redefine it. Cross-cutting security is C22; commercial math is C09; source transport is C06; platform placement is C23.
- `P0`: paid proof of truth. `P1`: repeatable product. `P2`: advanced intelligence. `P3`: end-state expansion earned by evidence. A P3 feature is not a launch dependency.
- Requirement and acceptance IDs are stable (`C07-R01`, `C07-A01`). Changes to public semantics require an ADR, version increment where incompatible, migration and regression cases.
- Official-source observations are in [research/sources.md](research/sources.md). Provider access, legal interpretation and model capability are not inferred from a successful HTTP response or marketing page.

## MECE ownership map

| Spec | Canonical responsibility | Does not own |
|---|---|---|
| [C00 Product](commerce/00-product-and-market.md) | ICP, jobs, differentiation, commercial proof | Prices or metric formulas |
| [C01 Control](commerce/01-control-plane-and-tenancy.md) | Tenants, users, membership, routing lifecycle | Commerce data processing |
| [C02 Connector contract](commerce/02-source-installation-and-sdk.md) | Installation, capabilities, source coverage | Vendor-specific protocol |
| [C03 Nhanh](commerce/03-nhanh-connector.md) | Nhanh protocol and certification | Generic ingestion engine |
| [C04 Haravan](commerce/04-haravan-connector.md) | Haravan protocol and certification | Generic ingestion engine |
| [C05 Shopee](commerce/05-shopee-connector.md) | Shopee access/protocol certification | Guessing private API details |
| [C06 Ingestion](commerce/06-ingestion-replay-publication.md) | Durable receipt, sync, replay, publication | Business interpretation |
| [C07 Canonical model](commerce/07-canonical-commerce-and-identity.md) | Identity, grains, events, source authority | Metric presentation |
| [C08 Quality](commerce/08-quality-reconciliation-lineage.md) | Coverage, reconciliations, lineage, certification | Merchant operating actions |
| [C09 Metrics](commerce/09-semantic-metric-contract.md) | Governed definitions, money/time/allocation | SQL executor internals |
| [C10 Query](commerce/10-query-serving-and-budgets.md) | Typed plans, authorization, snapshots, budgets | Model-generated raw SQL |
| [C11 Margin](commerce/11-sales-margin-and-channel-pack.md) | Sales and contribution decisions | Bank reconciliation |
| [C12 Cash](commerce/12-settlement-cod-and-cash-pack.md) | Settlement, COD, reserves, receivables | Statutory accounting certification |
| [C13 Stock](commerce/13-inventory-and-replenishment-pack.md) | Stock pools, coverage, aging, planning | Physical warehouse execution |
| [C14 Operations](commerce/14-fulfillment-returns-and-cost-pack.md) | Fulfillment, return operations, labor economics | Payroll decisions |
| [C15 Growth](commerce/15-customer-marketing-and-assortment.md) | Cohorts, acquisition, assortment, scenarios | Claiming attribution is causality |
| [C16 Investigation](commerce/16-insights-investigations-decisions.md) | Detection, explanation, work queue, decision record | Permission to execute |
| [C17 Ask Lumi](commerce/17-ai-analyst-and-model-routing.md) | Natural language, model routing, answer contracts | Recomputing business truth in an LLM |
| [C18 Experience](commerce/18-experience-and-dashboard-studio.md) | Navigation, dashboard authoring, accessibility | New brand design system |
| [C19 Delivery](commerce/19-notifications-sharing-and-exports.md) | Briefs, collaboration, exports, embeds | Public customer-data links |
| [C20 Packs](commerce/20-gitops-and-tenant-packs.md) | Config authoring, compilation, immutable releases | Arbitrary tenant executable code |
| [C21 Execution](commerce/21-governed-actions-and-lumi-agents.md) | Proposal/handoff/result contract | Reimplementing lumi-agents |
| [C22 Trust](commerce/22-security-privacy-and-data-rights.md) | Security, privacy lifecycle, audit, threat tests | Blanket compliance promises |
| [C23 Infrastructure](commerce/23-cloudflare-operations-and-scale.md) | Cloudflare cells, OLAP exits, recovery, cost | Building a general lakehouse |
| [C24 Commercial system](commerce/24-entitlements-billing-and-partners.md) | Metering, plans, onboarding operations, channels | Unvalidated public price promises |
| [C25 Interoperability](commerce/25-api-events-and-extension-boundary.md) | Public API, event contracts, client compatibility | Duplicating domain definitions |
| [C26 Verification](commerce/26-evals-and-release-gates.md) | Cross-domain test corpus, SLOs, release evidence | Claiming specs are implemented |
| [C27 Delivery](commerce/27-delivery-plan-and-decision-gates.md) | Dependency order, stages, stop/expand decisions | Calendar-only roadmaps |

## Read paths

Founder/GTM: C00 → C11–C16 → C24 → C27.

Implementation: C01 → C02/C03 → C06 → C07 → C08/C09 → C10 → C11/C12 → C18 → C26. Haravan contract validation and Shopee access discovery run alongside, not as permission to ship three unfinished adapters.

AI: C09/C10 → C16/C17 → C21/C22. Never begin with unconstrained text-to-SQL.

Operations: C01/C06/C08/C22/C23/C26.

## What constitutes completion

Each implementation PR names spec/acceptance IDs, shipped code paths, fixtures, measured evidence and remaining gaps. `Implemented` requires passing executable tests. `Merchant verified` requires a dated merchant reconciliation record. `Production certified` additionally requires authenticated Cloudflare staging, recovery and access tests. These states are distinct.

The [Databricks transfer note](research/databricks-transfer.md) explains which principles to reuse without inheriting a warehouse-sized organization. [Open questions](research/open-questions.md) are release blockers where noted, not footnotes to hide.
