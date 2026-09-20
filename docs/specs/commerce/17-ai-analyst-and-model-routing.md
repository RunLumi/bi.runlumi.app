# C17 — Ask Lumi, analytical agents and provider routing

Spec: C17 | Status: Target contract | Stage: P0 curated questions; P1 grounded Q&A; P2 bounded investigations; P3 adaptive planning

Owns: language understanding, model routing, answer/evaluation contracts and user correction. C09/C10 own numbers; C22 owns data egress; C21 owns actions.

## Outcome

A Vietnamese merchant asks a business question and receives a reproducible answer, its meaning, coverage and a useful next step. When data cannot answer the question, Lumi explains what is missing rather than filling the gap with confident prose.

## Query path

`question → authorized catalog retrieval → clarify ambiguity → typed semantic plan → server authorization/validation → deterministic query → claim table → answer rendering → citation/number verification`.

Allow tool contracts for metric.describe, metric.query, data.health, entity.explain and investigation.compare. Model receives only permitted metadata and bounded authorized results. It never receives arbitrary D1 access, hidden columns, raw credentials or authority to modify sources. A request to change a metric produces a draft under C20, not a runtime formula override.

## Contract

- **C17-R01:** disambiguate 'doanh thu', 'tiền về', 'lãi', 'tồn' using merchant defaults plus visible interpretation. Defaults are versioned and editable by a steward. Ask a clarification when alternatives materially change the decision.
- **C17-R02:** each numerical claim is a reference to a query result cell/range or a deterministic calculation with identified inputs. Verify amount, unit, scope, date and sign before display. A fluent answer with unsupported numbers fails.
- **C17-R03:** answer state is ANSWERED, PARTIAL, NEEDS_CLARIFICATION, INSUFFICIENT_DATA, STALE_DATA, FORBIDDEN or ERROR. Forbidden assets are not exposed through metadata or explanation.
- **C17-R04:** answers cite metric/version, source coverage, data manifest, business period and relevant evidence. Sources are authenticated internal links; inaccessible raw/customer material stays hidden.
- **C17-R05:** distinguish facts, estimates, forecasts and hypotheses. The model cannot infer conversion without traffic, historical profit without cost or realized cash from order status.
- **C17-R06:** model-generated text and source content are untrusted. Instructions embedded in product titles, CSV cells, notes, SQL comments or retrieved documents cannot change permissions, provider destinations or tool authority.

## Answer envelope

Fields: answer_id, tenant/principal scope digest, question/intent digest, interpretation, status, claims[{kind, value_ref, unit, metric_version, evidence_refs}], semantic_plan_hash, query_ids, context/data_release, limitations, alternatives, suggested_next_steps, model_route, latency/cost, verifier_result. Raw user questions may be sensitive: retention follows C22 rather than always logging text.

Examples:
- 'Doanh thu tuần này giảm vì đâu?' → reconcile source/definition health, comparable window and arithmetic drivers; do not claim causal explanation without evidence.
- 'Lãi thật trên Shopee bao nhiêu?' → clarify contribution versus statutory profit; surface missing fees/costs.
- 'Sao tiền về ít hơn doanh số?' → use C12 settlement bridge, not a guess about commissions.
- 'Mai nhập thêm bao nhiêu?' → use stock planning assumptions and constraints; produce proposal only.

## Provider-neutral design

Separate ProviderDriver, tenant-bound ProviderInstance, ModelCatalog and per-run RouteSnapshot. Initial certified direct adapters are chosen from available providers, not assumed interoperable. Target coverage: OpenAI, Anthropic, Gemini, compatible gateways, Azure/Bedrock where justified, Workers AI and approved local/on-prem endpoints. Claim support only after shared tool/structured-output/error/cancellation contract tests.

Route by data policy and region first, required capabilities second, measured task accuracy/latency/cost third. Credentials remain secret refs. No local-only → cloud fallback; no tenant-private instance fallback to another customer's key. OpenAI-compatible is transport compatibility, not semantic capability certification.

Budget requests, tools, context, result rows, cost and wall time. Retries distinguish transport retry from a paid repeated inference. Cache approved fact sets by authorization/snapshot, not arbitrary response text across tenants. Small classifiers/rules handle routing/extraction where evals support them; larger reasoning models are reserved for ambiguity.

## Memory and corrections

Store approved glossary/defaults separately from chat history, evidence and operational facts. User correction proposes a steward-reviewed update with regression examples. A frequent user assertion does not become financial truth. Do not train across customer data by default. Personalization cannot change metric semantics or role access.

## Acceptance

- **C17-A01:** identical supported question through dashboard and two certified providers yields the same numerical claim table.
- **C17-A02:** request for profit without COGS returns insufficient/partial data, not revenue relabeled profit.
- **C17-A03:** Vietnamese paraphrases/diacritics/abbreviations resolve to the correct approved metric or ask clarification.
- **C17-A04:** prompt injection in a product/statement cell cannot request secrets, raw SQL, another tenant or external sends.
- **C17-A05:** viewer cannot recover hidden unit costs through averages, comparisons, drill-down or remembered privileged conversation.
- **C17-A06:** provider outage respects privacy policy and budget; it does not silently reroute.
- **C17-A07:** every surfaced financial number passes deterministic citation/value verification; unsupported claims are removed or answer fails.
- **C17-A08:** model/prompt/catalog changes pass the Vietnamese analytical regression corpus before tenant activation.
