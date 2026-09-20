# C09 — Governed commerce metrics

Spec: C09 | Status: Target contract | Stage: P0–P3

Owns: business meaning, arithmetic, aggregation, time bases and availability. Excludes: source mapping identity (C07), query engine implementation (C10), UI styling (C18).

## Core rule

The dashboard, SQL template, Ask Lumi, brief and agent tool reference the same metric ID/version. A model cannot redefine revenue to answer a question. An operator cannot label a covered subset as company-wide profit.

## Contract

- **C09-R01:** each metric declares ID/version, Vietnamese/English name and synonyms, owner/reviewer, grain, formula, aggregation behavior, allowed dimensions/joins, event/time basis, exclusions, currency/tax basis, required source capabilities, freshness/coverage rule, effective date and certification state.
- **C09-R02:** amounts are exact scaled values; source decimals are parsed without binary-float drift. Currency conversions use dated, identified FX inputs and show native/base amounts. Do not sum currencies without conversion. No fixed legal VAT rate is embedded as universal truth.
- **C09-R03:** valid business dates use tenant timezone; instants are UTC. Windows are lower-inclusive/upper-exclusive internally. Source adapters explicitly translate their endpoint's inclusivity. Latest publication time is not the business period or source freshness.
- **C09-R04:** ratios use sums of compatible numerator/denominator facts, not averages of precomputed ratios. Stocks are semi-additive: aggregate across disjoint pools at an instant, not across snapshot dates. Undefined denominators return null with a reason.
- **C09-R05:** refunds, returns, cancellations, fees and payouts are separate facts. Each formula states which are included and on what date. Changes to recognition or funding classification require a versioned semantic release and impact preview.

## Minimum metric catalog

| Metric ID | Default meaning and denominator | Required boundary |
|---|---|---|
| `ordered_merchandise_value` | accepted order-line merchandise before seller-funded discounts, shipping/tax excluded where separable | Not recognized revenue; cancelled orders follow selected order cohort policy |
| `seller_discount_amount` | merchant-funded merchandise reductions allocated to lines | Platform funding kept separate |
| `net_merchandise_sales` | recognized merchandise value less allocated seller reductions and merchandise sales reversals | Defined recognition basis; excludes platform/service charges and unrelated cash movements |
| `recognized_order_count` | distinct canonical orders with recognized lines in scope | Joining lines does not multiply count |
| `net_aov` | net merchandise sales / recognized order count on the same cohort/time basis | Not sum or average of channel AOVs |
| `fulfilled_units` | sum fulfilled line quantities in canonical units | Partial shipments and bundles declared |
| `returned_units_rate` | returned units / fulfilled units for the same matured shipment cohort | Label open cohort and right-censoring |
| `cancelled_order_rate` | cancelled canonical orders / eligible accepted-order cohort | Not divide today's cancellations by today's orders indiscriminately |
| `refund_amount` | actual refund components by refund event date | Merchandise/tax/shipping components separate |
| `cogs` | effective cost consumed for recognized units less eligible COGS reversals | Requires cost-at-sale/history and restock/write-off policy |
| `gross_profit` | net merchandise sales − recognized COGS | Cost coverage must be complete for an unqualified total |
| `contribution_pre_ads` | gross profit + classified earned subsidies/shipping revenue − seller-borne platform/payment/fulfillment/other variable charges | Versioned component schedule; excludes working-capital transfers |
| `contribution_post_ads` | contribution_pre_ads − matched-period media spend | Allocation granularity explicit; not statutory net profit |
| `contribution_margin_rate` | contribution / matching net merchandise sales | Negative/zero denominator explained |
| `expected_settlement` | signed finalized/provisional statement components under source-specific settlement policy | Not bank cash; provisional/final status explicit |
| `observed_cash_received` | matched observed bank/carrier receipts | Not paid order status or escrow balance |
| `unreconciled_payout_amount` | absolute/signed residual after documented matching | Not recovered cash and not automatically platform error |
| `cod_outstanding` | expected remittance less matched receipts/authorized adjustments at as-of date | Delivered does not imply remitted |
| `available_units` | authoritative physical pool available stock, source semantics reconciled | Do not subtract reservations twice |
| `days_cover` | eligible available units / forecast or stated historical daily demand | No demand or censored demand requires explicit handling |
| `aged_inventory_value` | cost of stock in age bands using receipt/batch history | No movement history → proxy or unavailable, not exact age |
| `sell_through_rate` | units sold / stated available-to-sell cohort basis | Opening/received/returned/transfer policy disclosed |
| `fulfillment_lead_time` | event duration from declared accepted/paid checkpoint to carrier handoff | Source event availability and working calendar explicit |
| `on_time_handoff_rate` | eligible shipments handed off by source SLA / eligible due shipments | SLA is source/config versioned, not invented |
| `manual_minutes_per_order` | observed scoped human work minutes / eligible canonical orders | Worker/activity counts are not time measurements |
| `released_capacity_hours` | verified baseline workload − residual workload, volume/complexity normalized | Not payroll savings |
| `net_cash_savings` | evidenced expense actually removed − incremental run/review/support expense | No cash reduction → zero or negative |
| `mer` | matching net sales / total media spend | Blended descriptive ratio, not causal attribution |
| `reported_roas` | provider-reported attributed sales / provider spend | Preserve provider attribution window/model |
| `repeat_purchase_rate` | permitted identified customers with repeat eligible order / identified eligible customer cohort | Show identity coverage; masked buyers excluded and disclosed |

This catalog defines intended semantics, not universal accounting treatment. A finance steward approves recognition/cost/tax conventions for each merchant. Standard names cannot mask a changed formula.

## Allocation and cost invariants

Prefer source line allocations when authoritative. Otherwise allocate an order-level discount/fee using an approved basis (eligible pre-discount merchandise, quantity or explicit source weights). Use exact rational shares plus deterministic largest-remainder allocation to minor units; tie-break by stable line ID. Sum of line allocations equals the order amount exactly. Returns use original line allocations, not today's prices or cost catalog.

Financial component entries specify `kind`, `funding_party`, `sign`, `amount`, `currency`, `provisional/final`, `original_entry_ref` and `economic_time`. Withholding, reserve, refund and fees are not interchangeable expenses. A subsidy may fund the seller's merchandise receipt, other income or offset expense according to documented policy; never add it twice.

Example synthetic basket: merchandise 1,000,000; seller discount 100,000; merchandise reversal 180,000 → net merchandise sales 720,000. Effective net COGS 400,000 → gross profit 320,000. Seller variable fees 80,000 → contribution_pre_ads 240,000. Media spend 100,000 → contribution_post_ads 140,000. A payout or withholding does not belong in this formula. Missing COGS means gross profit is unavailable, not 720,000.

## Availability and revisions

Statuses include final, provisional, partial, estimated and unavailable, alongside freshness/coverage. A cost-covered subset can show its own margin and coverage, but cannot be extrapolated to total profit without a labeled model. Metric definitions have draft → reviewed → active → deprecated lifecycle. Query records `metric_version`, `semantic_release`, `data_version`, `recognition_policy`, `currency`, `timezone` and any estimation policy.

## Acceptance

- **C09-A01:** the synthetic basket above returns exact values through dashboard, semantic API and Ask Lumi facts.
- **C09-A02:** missing COGS/fees results in explicit unavailable/partial contribution, never a larger false profit.
- **C09-A03:** ratio-of-sums matches reference arithmetic; unweighted mean of channel margins is rejected.
- **C09-A04:** a three-line non-divisible discount allocates exactly with deterministic rounding and reversible partial-refund mapping.
- **C09-A05:** midnight local-time orders fall in the correct half-open day; no implicit UTC business date.
- **C09-A06:** same physical inventory observed on two dates is not summed as stock.
- **C09-A07:** GMV/order value, net sales, contribution, settlement and cash remain distinct under a refund+reserve fixture.
- **C09-A08:** a historical cost correction produces a restated semantic/data version while the prior report remains reproducible subject to retention/deletion policy.
