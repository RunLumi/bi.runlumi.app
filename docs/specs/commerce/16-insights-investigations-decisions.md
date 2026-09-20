# C16 — Proactive intelligence, investigation and decision loop

Spec: C16 | Status: Target contract | Stage: P0 rules and cases; P1 decomposition; P2 statistical detection; P3 experiments

Owns: detection lifecycle, analytical investigation and decision/outcome records. C08 owns data defects; C21 owns action authority.

## Outcome

A merchant receives a short queue of specific, material, evidence-backed exceptions—not an endless AI-generated news feed. Every item can be investigated, assigned, dismissed for a reason and evaluated later.

## Decision objects

Insight has type, subject, metric/version, baseline window, data manifest, comparison, materiality, reliability state, evidence refs and detector version. Investigation records hypotheses, permitted queries, deterministic findings, unresolved alternatives and stopping reason. Decision records owner, options, selected response, rationale, expected outcome, approval and review date. Outcome links actual observations without erasing the initial forecast.

States: `DETECTED → VALIDATED → TRIAGED → INVESTIGATING → DECISION_READY → ASSIGNED → AWAITING_OUTCOME → RESOLVED`. Alternatives: duplicate, false positive, accepted risk, insufficient evidence, stale, superseded. Data-quality defect routes to C08 and suppresses derivative business alerts when appropriate.

## Contract

- **C16-R01:** detector admission requires compatible baseline, sufficient data/coverage, metric eligibility and freshness. Suppress or downgrade when missing source changes can explain the signal.
- **C16-R02:** deterministic alert rules ship first: unmatched payout beyond due date, stale stock for critical SKU, missed fulfillment commitment, new unclassified fee, margin below approved floor. LLMs explain findings; they do not fabricate anomalies from prose alone.
- **C16-R03:** dedup incidents across windows/sources, apply cooldowns/hysteresis and group correlated findings. Show underlying conditions and changes since last notification. Every severity and priority has explainable factors.
- **C16-R04:** rank by materiality, urgency, evidence sufficiency and cost of attention. Estimated loss is shown as a range with assumptions; no single opaque priority score determines business action.
- **C16-R05:** investigation output distinguishes observed facts, arithmetic decomposition, plausible hypotheses, alternatives and unknowns. 'Why' is not a license for causal certainty.

## Investigation ladder

Start with source health and definition/version changes. Then compare appropriate period/cohort; decompose by channel/SKU/warehouse; inspect price/discount/cost/fees/returns; sample permitted underlying entities; formulate competing explanations; identify cheapest next evidence. If all sources are current but a fee classification changed, explain the accounting/semantic change before declaring a business collapse.

Each query is budgeted under C10 and tied to an Investigation ID. Stop after evidence resolves the question, the budget is exhausted, or an unavailable source makes further analysis unproductive. Preserve a concise evidence summary and query trace, not hidden model reasoning.

## Statistical phase

P2 detection uses seasonally comparable baselines, minimum sample sizes, robust dispersion, new-store/cold-start handling and multiple-testing control. Compare against simple seasonal-naive/rule detectors on merchant-reviewed historical incidents. Report false-positive rate and review burden, not only recall. Calibrate uncertainty empirically; a model-written '95% confidence' is not calibration.

Forecasts are separate from anomalies. Change points, holiday campaigns and source schema changes can invalidate baseline models. Detector rollback is versioned and does not delete past incident records.

## Closed-loop value

A recommended refund dispute becomes recovered cash only after a confirmed adjustment/receipt. A stock recommendation becomes an inventory outcome only after observed transfer/receipt/sales. Resolution means a user reviewed evidence or a defined verifier passed, not that an agent clicked a button. Track time-to-detection, time-to-owner, time-to-resolution, repeated defect rate and verified economic outcome classes.

## Acceptance

- **C16-A01:** dropped source coverage suppresses a false 'sales collapsed' business alert and produces a data-quality issue.
- **C16-A02:** the same overdue COD item across repeated checks creates one evolving incident, not daily duplicate tickets.
- **C16-A03:** investigation explains a definition change rather than attributing the delta to customer demand.
- **C16-A04:** root-cause response includes a competing hypothesis or explicit evidence limit where causality is not established.
- **C16-A05:** an alert without required cost/fee coverage cannot claim exact lost profit.
- **C16-A06:** a dismissed false positive improves only tenant-approved configuration/evals; it is not silently shared as customer data across tenants.
- **C16-A07:** resolution and action outcome remain pending if supporting source evidence has not yet arrived.
