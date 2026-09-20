# C13 — Inventory, working capital and replenishment

Spec: C13 | Status: Target contract | Stage: P0 current stock/coverage; P1 movement/aging; P2 forecast/planning; P3 constrained optimization

Owns: inventory decision products and planning logic. C07 owns identity; C09 owns shared measures; physical stock/PO writes belong to C21.

## Decision

Inventory planner: 'Which SKU/warehouse will run short before supply arrives, and where is cash trapped in stock that is not moving?' Founder: 'Which proposed purchase/transfer has evidence strong enough to review?' The product must avoid recommending the same physical unit to several storefronts.

## Inputs and limitations

Current-stock MVP needs canonical variants, authorized stock pools, source inventory semantics and freshness. Receipt/movement history unlocks actual aging/valuation. Costs unlock working-capital value. Purchase orders, receipts, lead times and minimum order quantities unlock replenishment scenarios. Historical sales alone does not reveal unconstrained demand during stockouts.

## Contract

- **C13-R01:** choose one authoritative source per physical stock pool and metric. Channel listing quantities may represent allocation/advertised stock, not independent stock. Do not sum identical pools across OMS/marketplace feeds.
- **C13-R02:** preserve on-hand, reserved, available, damaged, in-transit and source-specific categories. A supplied available value is not reduced again by reservations. Derived formulas require documented overlap/disjointness.
- **C13-R03:** negative stock, missing warehouse coverage and stale inventory are visible exceptions. A recommendation dependent on unavailable stock is blocked or explicitly provisional, not confidently actionable.
- **C13-R04:** inventory age requires receipt/batch/movement evidence. 'No sale for 90 days' is a sales-inactivity proxy, not the age of current stock. Historical snapshots only support history from when they were collected.
- **C13-R05:** days cover and reorder suggestions declare demand basis, horizon, lead-time assumption, service target, inbound commitments, safety stock and uncertainty. Unknown/zero demand produces no finite reliable cover, not arbitrary infinity rendered as safe.

## Initial surface

An exception workbench, not a grid of every SKU. Tabs: impending stockout; excess/no movement; mapping/coverage issues; inbound commitments. Each item shows variant/photo label, warehouse/stock pool, physical versus advertised stock, observed timestamp, demand window, available stock, next supply date, proposed action and confidence limitations. Drill-down explains exactly which sales/demand periods and supply records contributed.

## Planning progression

P0: transparent historical demand rate and manual thresholds, with stockout/campaign flags. P1: effective-dated pack/bundle mappings; FIFO/batch age where data supports it; transfer candidates based on disjoint pools and lead time; season/campaign annotation.

P2: compare seasonal-naive and statistical forecasts using rolling-origin tests. Handle intermittent demand, new SKUs and returns separately. Report prediction intervals and censor periods with unobserved unmet demand. Evaluate forecast bias plus business stockout/excess cost, not only average forecast error. No universal model for every SKU.

P3: constrained allocation/replenishment under budget, warehouse capacity, MOQ, supplier lead time and channel service constraints. Show feasibility and sensitivity. If a constraint cannot be observed, require the planner to supply it; do not optimize imaginary certainty.

## Scenario and outcome ledger

Saved plan records baseline publication, forecast model/version, assumptions, suggested quantities, approval and execution state. Accepted transfer/PO is not received stock. Measure fulfillment of the plan through subsequent source observations and compare against a documented counterfactual where feasible. Savings from avoided stockout remain estimates; cash freed from lower purchases needs observed purchase/stock evidence.

## Acceptance

- **C13-A01:** one physical pool advertised on two marketplaces is not doubled; two genuine warehouses remain additive.
- **C13-A02:** available=10 already excludes reserved=3: product displays 10, not 7.
- **C13-A03:** a newly connected source with no receipt history shows stock aging unavailable or clearly labeled proxy.
- **C13-A04:** zero sales during an out-of-stock period does not prove zero demand; forecast marks censoring.
- **C13-A05:** bundle mapping revision changes future demand/cost decomposition only according to effective dates.
- **C13-A06:** stale/missing warehouse input prevents automatic replenishment handoff.
- **C13-A07:** forecast promotion requires improvement over a declared baseline on held-out windows and known failure segments.
- **C13-A08:** inbound PO is not counted as available stock before observed receipt.
