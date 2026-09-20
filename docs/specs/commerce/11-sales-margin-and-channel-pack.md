# C11 — Sales, margin and channel economics pack

Spec: C11 | Status: Target contract | Stage: P0 sales/margin coverage, P1 fully costed pack, P2 scenario planning

Owns: merchant decisions about sales mix, variable contribution and channel economics. Formulas are C09; settlement/bank truth is C12.

## Decision and user

Founder/commerce manager: 'Which products/channels are producing contribution rather than attractive GMV?' Finance steward: 'Can I explain every component and what is not yet known?' The pack's outcome is a reviewed pricing, assortment, discount or fulfillment decision with evidence—not a larger dashboard count.

## Required input and progressive availability

Base sales requires canonical order/line identities, recognition policy and source coverage. Gross profit requires effective COGS. Contribution requires source-specific variable charge classification. Post-ad contribution requires matched spend coverage. Each level unlocks only when inputs support it. Current SKU cost can support a labeled estimate, never masquerade as historical actual.

P0 screen: net sales and order count with definition, top positive/negative contribution where available, unknown-cost/fee exposure, return impact and a ranked review queue. Filters: business period, order cohort versus adjustment date, legal entity, storefront/channel, canonical SKU/category, warehouse where attribution is valid. Mixed perspectives are prohibited.

## Contract

- **C11-R01:** every displayed margin waterfall reconciles exactly to its metric components and scope. Deductions name merchant versus platform funding; gross payout and net payout fields cannot both enter contribution.
- **C11-R02:** sort unknown-margin items into an explicit unknown category, not as zero margin or below all profitable SKUs. Show value/units covered by verified cost, estimated cost and no cost.
- **C11-R03:** aggregate at line/financial-entry grain before joins. Bundle costs use the effective component mapping and allocation; merchandising can display parent bundle while retaining auditable components.
- **C11-R04:** comparison decomposes changes into documented factors (volume, mix, unit price, seller discount, cost, fees, returns). The decomposition algorithm defines interaction handling and ordering; the sum of factors equals total delta.
- **C11-R05:** show descriptive drivers, not causal claims. A higher fee coinciding with lower margin is evidence for investigation, not proof that a platform caused the loss.

## Merchant workflow

Open channel/SKU waterfall → inspect coverage → drill into loss-making order lines → open source details and financial components → assign a case → attach proposed change and expected range → approve externally or via C21 → record outcome. An operator can export a scoped evidence table for discussion without granting access to raw PII.

Support question examples in Vietnamese:
- 'Bán nhiều nhưng còn lại bao nhiêu sau phí?'
- 'SKU nào giảm lãi vì giá vốn, phí hay hàng hoàn?'
- 'So cùng ngày trong tuần, kênh nào tăng doanh thu nhưng giảm đóng góp?'

## P2 scenarios

Allow a saved scenario for price, discount, fee schedule, cost or return-rate change. Display baseline version, changed assumptions and sensitivity table. Preserve volume/elasticity as separate assumptions; do not assume units sold remain constant after every price change. A forecasted improvement never enters actual contribution. Scenario outputs can become an experiment proposal, not automated price writes.

## Boundaries and failure modes

Inventory valuation does not establish expense recognition. Ad-reported revenue must not be added to order sales. Marketplace subsidies may require merchant-specific treatment. Unmapped financial components block unqualified full contribution. Late returns restate cohorts while adjustment-period views remain separate.

## Acceptance

- **C11-A01:** merchant reproduces three sales totals, one refund and one variable-charge waterfall against dated source controls.
- **C11-A02:** cost coverage is 70%: product labels the covered subset and unknown exposure; no whole-business gross-profit claim.
- **C11-A03:** the same marketplace order in two feeds remains one sale in channel comparison.
- **C11-A04:** changing current catalog price/cost leaves historical actual waterfall unchanged.
- **C11-A05:** decomposition factors sum to the actual delta including any disclosed interaction residual.
- **C11-A06:** scenario recommendation is labeled hypothetical, stores its assumptions and cannot alter actual metric history.

## Proof gate

Proceed beyond P0 only when merchants repeatedly use this pack to review contribution or charge leakage and the data/support burden fits C24 economics. A customer who only wants native-platform sales totals is not evidence for this pack's differentiation.
