# C24 — Commercial packaging, entitlements and partner operations

Spec: C24 | Status: Target contract; price points unvalidated | Stage: P0 paid pilot; P1 repeatable subscription; P2 partner distribution

Owns: packaging mechanics, metering, tenant commercial lifecycle and implementation economics. C00 owns market hypothesis; C01 owns authorization; no pricing label may grant data access.

## Outcome

A merchant can understand what is included, why it is worth paying for and what happens at a usage limit. Lumi can deliver repeatedly without support work consuming all gross margin. A subscription buys maintained decision workflows, not a collection of empty dashboard slots.

## Pilot offer

One named decision pack, one operational source plus one marketplace/statement source, specified shop/warehouse coverage, a bounded historical window, three agreed metric controls, one discrepancy/workbench and a dated review. Price is a fixed setup/pilot fee plus a clearly stated post-pilot subscription proposal. A commercial offer specifies source-access dependencies, exclusions, manual versus automated data paths and who approves business definitions.

Existing RunLumi AI implementation messaging 'from 9.9m VND' does **not** automatically price this distinct BI service. Price experiments require founder approval and merchant evidence. Do not publish a market-optimal number without testing it. Keep proposed prices, signed quotes, active plans and grandfathered contracts as separate records.

## Contract

- **C24-R01:** entitlement snapshot is versioned central metadata: plan, enabled packs/capabilities, source-account allowance, retained history, usage budgets, support scope, billing state and effective dates. It is intersected with authorization, never substituted for it.
- **C24-R02:** billable usage has auditable event identity, period, quantity/unit and adjustment history. Retries and duplicate source observations are not double-billed. Prefer unique canonical processed orders where order-based pricing is used; describe backfill/reprocessing treatment explicitly.
- **C24-R03:** show included versus metered inference/advanced-query/export use and notify before material overage. Budget failure degrades optional work predictably; no surprise unbounded AI bill.
- **C24-R04:** basic tenant isolation, source provenance, data correctness and access revocation are not optional luxury add-ons. Safe export/exit is available under the stated contract; do not hold customer data hostage to a configuration dispute.
- **C24-R05:** cancellation, non-payment and platform outage have different lifecycle policies. Suspension does not silently delete data or continue expensive new jobs indefinitely. Honor declared export/retention terms.

## Packaging dimensions

Recommended axes to validate: decision-pack scope; source accounts/shops and operational complexity; retained history/data volume; service/support tier; advanced inference budget. Do not charge for every dashboard/filter/metric simply because the renderer can count them. Charge for custom integration effort as a scoped project with reusable outputs, not unlimited 'AI customization'.

P1 plan families can be Core Truth, Multi-channel Operations and Managed Intelligence, but names/features are experiments until tested. Upgrades preserve canonical IDs/data history and require no reimplementation. Capability-limited trials use clearly synthetic or authorized sample data, never cross-tenant demo copying.

## Operator workbench

For each merchant: onboarding stage, source approval blockers, reconciliation progress, definition signoff, pack release, support cases, usage cost and value evidence. Standard onboarding produces a reusable checklist/mapping/fixture bundle. Consultant changes are reviewed as config releases. Privileged support has C22 approval/expiry.

Track contribution after infrastructure, model cost, implementation labor, support/reconciliation effort and partner commission. First implementation cost and ongoing support are different. A large setup invoice does not prove SaaS economics. Provisional reuse gates: third similar deployment in less than one engineering day, with most logic from shared packs; revise thresholds using actual merchant complexity.

## Distribution and partner boundary

Founder-led acquisition first: 10–30 highly relevant merchants, explicit report reconciliation demo, scoped paid pilot, then a documented before/after case. Keep native platform dashboards in the sales comparison; demonstrate the specific cross-source gap. Avoid broad generic AI advertising before repeatable conversion.

P2 implementers/agencies/accountants can manage merchant accounts only through explicit tenant delegation. A partner installation does not transfer merchant ownership or allow cross-merchant joins. Partner commission ledger supports contract versions, earned/paid/refunded states and disputes. Shared benchmark products require separate privacy/legal review and aggregation protections; raw merchant rows are not a distribution asset.

## Acceptance

- **C24-A01:** duplicate webhook/replay/API+OMS order does not inflate canonical-order billing.
- **C24-A02:** downgrading a plan cannot expose hidden data; upgrading cannot bypass membership/source scopes.
- **C24-A03:** before a budget cap is exceeded, merchant sees impact and options; deterministic essential views remain available within policy.
- **C24-A04:** cancel/suspend/reinstate preserves data/export behavior stated in the contract and does not reinstall duplicate sources.
- **C24-A05:** partner A cannot inspect an undelegated merchant B or combine merchants without explicit permission.
- **C24-A06:** delivery economics report includes human support and onboarding, not merely Cloudflare request charges.
- **C24-A07:** a public price claim maps to an approved product/contract version; draft experiments are not presented as settled pricing.
