# Commerce implementation record

The spec suite is the target. This index records executable increments and gaps.
`Implemented within a bound` is not merchant verification or production certification.
No feature is considered complete merely because its UI label, interface or target
spec exists. Code in this record is tested with synthetic data unless stated otherwise.

| Increment | Implemented result | Evidence owner |
|---|---|---|
| Foundation | Central control, bounded tenant cells, operation metrics, reviewed packs, React workspace | [PR2 alignment](../pr2-commerce-alignment.md) |
| 01 | Private raw receipts and durable outbox adapter | [01](01-durable-export-receipts.md) |
| 02 | Typed interchange normalizer, exact arithmetic, quarantine and staging identities | [02](02-normalization.md) |
| 03 | Reviewed cross-source publication, money/stock UI, observed findings, decision history and private exports | [03](03-reviewed-publication-and-decisions.md) |
| 04 | Versioned commerce metric catalog and bounded publication-backed query contract | [04](04-governed-commerce-query.md) |
| 05 | Owner-reviewed per-resource capability and coverage matrix with publication gates | [05](05-capability-coverage-review.md) |
| 06 | Role-scoped commerce metric catalog and publication-backed query denial for sensitive fields | [06](06-field-scoped-commerce-query.md) |
| 07 | Tenant-scoped durable normalization jobs with transactional admission and lease fencing | [07](07-durable-commerce-jobs.md) |
| 08 | Canonical audited tenant lifecycle with fail-closed control-plane fencing | [08](08-tenant-lifecycle-fence.md) |
| 10 | Versioned core packages, generated customer repositories, per-environment deployment identity with a server-owned registration registry, enforced boundaries, reproducible packaging and reviewed upgrades | [10](10-customer-application-base.md) |

## Complete specification inventory

| Spec | Current executable boundary | Work not yet implemented/certified |
|---|---|---|
| C00 | Product and commercial tests specified | Paid merchant demand/ROI and acquisition evidence |
| C01 | Authenticated memberships, route identity, control/data cells, bounded job admission, audited lifecycle fence | Fleet migration, support grants and service-authenticated consumer admission |
| C02 | Owner-authorized export scope, source revision, immutable raw metadata and reviewed capability/coverage states | OAuth/PKCE installation, secret broker, provider capability certification |
| C03 | Nhanh source labels in checked interchange | Actual Nhanh transport, incremental sync and installation tests |
| C04 | Haravan source labels in checked interchange | Actual Haravan transport, auth/event certification |
| C05 | Shopee source labels in checked interchange | Authorized app/region/scopes, official protocol certification and adapter |
| C06 | Raw/outbox, bounded durable job consumer, quarantine, immutable publication and CAS | Chunked runs, deployed Queue transport/consumer, dead letters, outage/orphan recovery |
| C07 | Opaque source identity, reviewed aliases/priorities, stock gauges | Full line/bundle/payment/refund/fulfillment/event model and source authority packs |
| C08 | Independent declared counts/totals fail closed; report lineage; capability gaps downgrade dependent metrics | Authenticated control evidence, provider completeness/reconciliation certification |
| C09 | Exact order-cohort money, cost/fee/income nulls, statement cash, physical units; versioned bounded catalog | Full metric registry, line/event-time/FX semantics, compatible release lifecycle |
| C10 | Operations typed/batched queries; bounded owner-reviewed and role-scoped commerce query over published reports | Dimensions, row scope, async jobs, admission/fair-share budgets and broader viewer policy |
| C11 | Bounded merchandise/cost/contribution review with provenance | Channel/SKU/line analysis, restatement coverage, ads and complete source certification |
| C12 | Signed final/provisional statements, explicit cash allocations, residuals | COD/carrier/bank imports, automated matching proposals and aging |
| C13 | Physical pool/variant latest gauges; missing/negative availability | Movements, stock aging, demand/censoring/forecast/replenishment policies |
| C14 | Operations cost dashboard and basic commerce findings | Shipping/return SLA models, full exceptions and measured labor attribution |
| C15 | No runtime feature | Customer identity/cohorts, marketing spend/attribution and assortment scenarios |
| C16 | Deterministic findings, owned decisions, immutable history, positive outcome gates | Recurrence/snooze/scheduling, richer investigations and calibrated proposals |
| C17 | Disabled tenant-scoped provider configuration only | Actual multi-provider analyst, governed planning, verification and budget enforcement |
| C18 | Vietnamese report, stock, ingestion/review, decision and operations screens | Full authoring studio, saved semantic queries, broader accessibility/UX certification |
| C19 | Authenticated snapshot CSV/JSON, current revocation and formula defenses | Scheduled briefs, recipient authority, delivery dedup, XLSX/PDF/embeds |
| C20 | Operator-asserted immutable packs and activation/rollback | Verified GitHub/OIDC source attestation, tenant-local pointer migration and compatibility DAG |
| C21 | Decisions explicitly execute nothing | Approved action proposal, Lumi Agents handoff, scoped retries and outcome receipts |
| C22 | Server tenant/role checks, private storage contract, source revocation, lifecycle fencing and reviewed commerce field denial | Row/column policy system, privacy deletion/replay tombstones, support access and security assessment |
| C23 | Cloudflare cell configuration/runbooks, bounded synchronous paths, local durable job admission/leases | Workerd/staging Queue, restore/load/tenant fairness, async OLAP exit evidence |
| C24 | License feature/time/grace checks | Metering/admission accounting, seats, billing/payment/partner operations |
| C25 | Versioned internal response contracts, bounded API endpoints and durable job metadata | Public SDK/OpenAPI, compatibility/deprecation and signed extension events |
| C26 | Synthetic math/isolation/race/tamper and browser regressions | Authenticated cloud, load, recovery, live-source and merchant acceptance gates |
| C27 | Dependency-ordered increments with explicit exclusions | Paid proof, repeatability, support economics and earned expansion |

## Next dependency order

1. Reviewed metric releases and permission-scoped commerce typed queries with
   shared answer evidence; exact metric/time/scope contracts before an LLM plans
   queries.
2. Source/field permissions, scoped credentials and a service-authenticated job
   consumer; then the first real provider transport, certified against an
   authorized installation.
3. Chunked full-source publication, line/event facts and reconciliation; preserve
   the bounded review path as a useful diagnostic, not a fake bulk importer.
4. Governed analyst, scheduled delivery and action handoff on those authority/data
   contracts; expand stock/growth/operations packs only with necessary data.

Do not keep extending the small importer cap or substitute a green unit suite for
merchant/source/workerd evidence. The broader end-state remains owned by
[C27](../specs/commerce/27-delivery-plan-and-decision-gates.md).
