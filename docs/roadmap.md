# Commerce delivery roadmap

The canonical end-state and staged release gates are in
[C27](specs/commerce/27-delivery-plan-and-decision-gates.md). This file records the
implemented foundation and immediate transition, not a second competing roadmap.

## Current foundation

Central control and bounded tenant cells; immutable operator-registered configuration
packs; React workspace; batched semantic dashboards; an operations-cost evidence pack;
negative authorization and configuration tests. See [alignment](pr2-commerce-alignment.md).
No live Nhanh, Haravan or Shopee adapter is certified. Ask Lumi is not implemented.

## First paid proof

Secure authorized access to one merchant's operational source and a closed settlement
period. Implement the first ingestion/replay slice, canonical identity and source
precedence; reconcile three governed metrics with the merchant. Start Money Truth
from verifiable numbers, not from a generative dashboard demo. Validate Haravan
contracts and Shopee access in parallel without claiming three shipped adapters.

## Earn repeatability

Prove the same workflow at several merchants with decreasing implementation effort.
Then add Stock Decisions and Operations Exceptions when data coverage and support
are ready. Gate Ask Lumi on metric/query/evidence correctness; gate actions on
lumi-agents policy, approval and outcome verification.

## Do not expand merely to complete a diagram

No universal warehouse, arbitrary SQL, public extension marketplace, unreviewed
finance metrics, synthetic success claims or autonomous refunds/inventory/price edits.
A missing API scope, high exception rate, weak savings or irreconcilable data is a
reason to narrow the offer before adding infrastructure.
