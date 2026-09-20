# C14 — Fulfillment, returns and operating effort

Spec: C14 | Status: Target contract | Stage: P0 exception visibility; P1 cost evidence; P2 process optimization

Owns: order-to-handoff and return-operation decisions plus labor economics. Finance treatment of refund/cash is C09/C12. Does not own employee surveillance or staffing decisions.

## Decision

Operations lead: 'Which orders or returns will miss their next commitment, and where are repeated handoffs consuming work?' Founder: 'Did automation actually reduce operating effort or expense while maintaining service quality?'

## Contract

- **C14-R01:** lifecycle records keep accepted/paid, allocated, picked, packed, handed-to-carrier, delivered, return-requested, received-return, inspected, restocked and refunded as distinct observed events. Unknown timestamps remain absent; polling observation time is not the actual event timestamp.
- **C14-R02:** service commitments come from verified source SLA or tenant policy/calendar with effective dates. Do not invent a platform dispatch deadline or calculate all durations in calendar days when the contract uses business days.
- **C14-R03:** one order may split into packages and partially return. Queue at the actionable package/return-line grain; aggregate carefully for owner views.
- **C14-R04:** process diagnostics track time between observed stages, blocked reason, exception age and ownership. Correlation by warehouse/carrier/SKU suggests investigation, not blame or employee performance scoring.
- **C14-R05:** distinguish released capacity, avoided future expense, realized expense reduction and recovered cash. Runtime/model costs, review/exception labor, maintenance and implementation are included in their appropriate horizon.

## Workbench

Due soon; overdue; waiting on customer/carrier; unreceived return; refund/restock discrepancy; source data issue. Each case has next commitment, evidence, owner, due date and a suggested bounded next step. Duplicate source alerts merge into one case. Cases become un-actionable if their underlying source is stale or the target was cancelled.

Returns view links physical receipt and refund state without assuming one implies the other. A refunded-without-receipt item may be legitimate policy, damaged goods or an unresolved mismatch; classify before escalating. Partial refunds and restocking fees retain component identity.

## Cost-center model

`baseline_work_minutes = normalized_eligible_volume × observed_baseline_minutes_per_case`

`residual_work_minutes = actual human review + exception handling + observed manual remainder`

`released_capacity = baseline_work_minutes − residual_work_minutes`

`net_cash_savings = evidenced expense removed − incremental runtime/review/support cash expense`

Use task sampling/time studies or explicit customer declarations with evidence class. Number of clicks, user seats or AI actions is not a valid time baseline. Before/after comparisons account for volume, complexity, seasonality and changes in operating scope. Avoid adding both loaded labor capacity value and reduced payroll as two independent savings for the same work.

Synthetic guardrail inherited from bootstrap: 74 hours released and 0 expense actually removed can yield negative net cash benefit after runtime cost. Payback based on cash is unavailable when net cash benefit is not positive. A separate capacity-value scenario may be presented and clearly labeled.

## Automation boundary

Start with recommendations and internal work-item drafts. Routine status checks/report preparation can eventually run unattended within approved scope. Customer messages, refunds, cancellations, shipment changes and inventory writes need C21 approval/policy and live-state verification. Do not sell headcount reduction as a universal guarantee.

## Acceptance

- **C14-A01:** split shipment with one late package creates one late actionable item and correct order-level summary, not duplicate revenue.
- **C14-A02:** source omits carrier-handoff timestamp: lead time cannot be marked exact from the polling receipt time.
- **C14-A03:** returned, refunded and restocked states can diverge without a forced false lifecycle transition.
- **C14-A04:** 74 released hours/zero avoided cash expense never yields positive cash savings or a fabricated payback.
- **C14-A05:** doubling order volume does not look like process deterioration if minutes/case is unchanged; workload and efficiency are shown separately.
- **C14-A06:** previously overdue order cancelled before action handoff is revalidated and proposal expires.
- **C14-A07:** operational evidence does not include continuous employee screen/keystroke recording.
