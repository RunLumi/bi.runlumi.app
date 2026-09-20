# C15 — Customer, acquisition and assortment intelligence

Spec: C15 | Status: Target contract | Stage: P1 descriptive cohorts, P2 acquisition/scenarios, P3 controlled experiments

Owns: merchant customer/cohort insights, media efficiency and assortment decisions. C09 owns definitions; C22 owns identity/data rights; C21 owns campaign or price writes.

## Outcome

Commerce managers can distinguish repeat demand from acquisition spend, see SKU/category mix and returns, and test a proposal without mistaking attribution, correlation or missing buyer identity for commercial truth.

This is not a CDP replacement or consumer profiling platform. Do not require a merchant to centralize all personal data to get basic commerce intelligence.

## Contract

- **C15-R01:** customer analysis uses permitted source identifiers and reviewed deterministic same-tenant links. Masked marketplace buyers and anonymous POS orders remain separate/unresolved; coverage is shown in every customer KPI.
- **C15-R02:** cohort eligibility defines first purchase, cancellation/refund exclusions, observation window and currency. New cohorts have incomplete follow-up and cannot be compared to fully matured cohorts without labeling censoring.
- **C15-R03:** traffic conversion requires independently available sessions/visits with bot/filter/window definitions. Orders divided by another order count is not conversion rate.
- **C15-R04:** media data preserves account, campaign, date/timezone, currency, attribution window/model and finality. Platform-reported attributed revenue is never added across overlapping platforms as total merchant sales.
- **C15-R05:** MER is a blended descriptive ratio; reported ROAS is vendor-defined attribution; incremental return requires an experiment or explicit causal assumptions. Ask Lumi and dashboards must retain the distinction.

## P1 questions

'What fraction of identified customers bought again within 60 days?'; 'Which category has repeat purchase with low return burden?'; 'Which bundle creates contribution rather than just larger order value?' Answer at identifiable coverage only. RFM labels are descriptive segments with versioned windows, not judgments about a person's financial status.

Assortment matrix combines sales velocity, contribution coverage, return burden and stock availability. High revenue plus unknown cost is a data issue, not a recommended winner. Basket-affinity suggestions require minimum support and out-of-sample checks; co-purchase does not prove a bundle will increase margin.

## P2 media and scenarios

Add Meta Ads, Google Ads/GA4 or other sources only after an authorized access/capability spike and repeated merchant demand. Separate spend reconciliation from attribution interpretation. Later TikTok Shop supports the chosen commerce decision; advertising permissions are separately scoped. No implied universal access to Shopee ads because shop orders are readable.

A saved scenario can adjust price, discount or media spend and calculate contribution under declared demand/return/cost assumptions. Elasticity is a model/assumption with uncertainty. The system must not claim a 10% price increase leaves volume unchanged unless explicitly set as a scenario assumption.

Campaign calendar supports merchant-defined 9.9/11.11/promotion/Tet windows with source and effective dates. It is context for comparisons, not a hardcoded official trading schedule. Compare like-for-like weekdays, promo phases and available days; expose denominator changes.

## Experiments and learning

P3 ExperimentPlan stores unit of randomization, treatment, control, start/end, primary outcome, guardrails, interference risk and analysis plan before execution. Quasi-experiments state identifying assumptions. Price/ad experiments affecting consumers require ordinary business approval, not an AI-generated directive. Maintain observed effect versus model expectation separately.

## Acceptance

- **C15-A01:** 40% identified-customer coverage produces a scoped cohort report, not full-market customer retention.
- **C15-A02:** overlapping ad-platform attributed conversions do not exceed known sales by being presented as a de-duplicated total.
- **C15-A03:** no traffic source means conversion is unavailable; Ask Lumi explains the missing input.
- **C15-A04:** comparison of immature and mature repeat-purchase cohorts is blocked or explicitly adjusted/labeled.
- **C15-A05:** assortment recommendation cannot rank unknown margin as profitable by treating missing COGS as zero.
- **C15-A06:** scenario result remains hypothetical and cannot alter actual metric history or spend automatically.
- **C15-A07:** a claimed incremental improvement links to an experiment/causal analysis record, not merely a before/after chart.
