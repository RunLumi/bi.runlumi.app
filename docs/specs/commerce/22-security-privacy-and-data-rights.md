# C22 — Security, privacy and customer data rights

Spec: C22 | Status: Target contract | Stage: P0 mandatory baseline; P1 auditability; P2 enterprise controls

Owns: threat model, credential/data lifecycle, cross-surface authorization and privacy controls. C01 owns membership/routing mechanics; C21 owns action handoff. This spec is not a legal opinion or certification.

## Threat model

Protect against tenant-ID confusion; swapped bindings; compromised connector credentials; malicious webhook bodies; raw SQL/SSRF; hostile Git packs; prompt injection in catalog/notes/files; export/embedding leakage; revoked-user caches; support overreach; source/LLM subprocessor leakage; duplicate financial actions; replay after deletion; and compromised deployment/update dependencies.

Separate the blast radii of central metadata, each data cell, source credential service, ingestion, query serving, pack publishing and agent execution. A cell Worker with several D1 bindings can access all those resources; per-tenant databases alone are not complete compute/IAM isolation.

## Contract

- **C22-R01:** every data surface authorizes tenant plus resource/row/column/metric scope server-side, including metadata, search, lineage, cache, notifications, AI history, jobs, exports and support views. A guessed opaque ID is not a permission.
- **C22-R02:** source/model credentials are tenant-bound references. Use approved secret storage or envelope encryption with a separately protected wrapping key; ciphertext in D1 is not sufficient if the same untrusted process exposes both keys and data. Rotate, version and revoke; never log request Authorization, OAuth codes or refresh tokens.
- **C22-R03:** network targets are registered provider endpoints or approved customer sources. Restrict schemes/hosts/ports, redirects and resolved address ranges; disallow local/metadata endpoints and DNS-rebinding escape. A model or pack cannot register a new egress destination.
- **C22-R04:** record a data inventory with purpose, field sensitivity, controller/processor responsibilities, source contract, permitted recipients, retention, deletion policy and cross-border processing decisions. Required Vietnam/other-market obligations must be verified for the deployment with qualified advice where needed; do not encode universal legal deadlines, exemptions or consent assumptions from this design.
- **C22-R05:** data minimization applies before storage, retrieval and model egress. Basic inventory/financial intelligence should not require raw buyer addresses/phones. Masked marketplace data is not reverse-engineered.
- **C22-R06:** logging defaults exclude raw order/customer rows, credentials, question/answer payloads and model reasoning. Preserve IDs, counts, hashes, timings and classified errors. Cloudflare AI Gateway's default payload logging must be explicitly overridden and tested where used. [F7](../research/sources.md#f7)

## Source and webhook security

TLS endpoint, provider-specific verified authenticity, body limits, replay/dedup protections and connection/business binding are required. Public provider callbacks cannot be placed behind an interactive Access login redirect that prevents provider delivery; instead use a narrowly exposed verification endpoint. Queue messages contain opaque references and receive authorization/connection-state validation again at consumption. Read-only business capability is enforced even for APIs whose reads use POST.

OAuth sessions use state nonce/expiry and verified provider identity. PKCE, signature algorithms and token transport follow the actual provider contract. Refresh concurrency uses credential generations; credential probes must not silently create broad scopes or install new hooks.

## Data lifecycle and deletion

Tenant-configurable retention has bounded product defaults and data-class limits. Raw archive 'immutable' means not editorially rewritten during its retention period, not retained forever. Data-subject/tenant deletion uses a durable suppression/deletion ledger; queued jobs, replay normalizers, retrieval indexes and exports check it so deleted data cannot resurrect.

Deletion inventory includes R2 objects/segments, D1 canonical/serving data, cache, exports, AI histories/embeddings, support attachments and provider-side logs where under Lumi control. Shared raw segments containing deleted PII require rewrite plus manifest/tombstone updates or another verified erasure mechanism; deleting a pointer alone is not data erasure.

Backups may have retention constraints. Document residual retention, access restrictions and restore procedures; replay deletion records before restored data is queryable. Subject deletion can revoke historical reproducibility and must return an honest `DATA_REMOVED` result rather than recover PII from old reports. Disconnecting a source stops ingestion immediately and follows the explicitly chosen retain/delete lifecycle; it is not always the same action as tenant erasure.

## AI and inference boundary

Provider policy declares permitted models/endpoints, region/retention options and data classes. Local-only routing cannot fall back to a cloud model. Never infer Vietnam-only data residency from globally distributed Workers or a location hint. Customer BYOK changes billing/credential ownership, not privacy obligations. Cross-tenant training or benchmarking on raw/private customer data is off unless separately authorized and reviewed.

Support access requires purpose, approval, scope, expiry and audit. Break-glass access is time-bound, reviewed and does not disable logs. P2 enterprise SSO/SCIM, customer-managed keys or dedicated accounts are capability choices with verified guarantees, not premium marketing labels without implementation.

## Acceptance

- **C22-A01:** a negative-access matrix covers A→B for every data and metadata surface, including AI inference and historical exports.
- **C22-A02:** malicious source URL, redirect, webhook field or Git model endpoint cannot reach internal metadata/private hosts or another tenant.
- **C22-A03:** secrets are absent from fixtures, source trees, traces, errors and gateway payload logs under failure as well as success.
- **C22-A04:** deleting a subject/tenant followed by Queue retry, raw replay and backup restore cannot resurrect accessible data.
- **C22-A05:** raw segment deletion and export invalidation are verified, not merely marked done in a task table.
- **C22-A06:** a revoked support grant or membership denies sensitive access despite cached data or an active AI conversation.
- **C22-A07:** source-borne prompt injection cannot expand tools, change provider egress or create operational authorization.
- **C22-A08:** pre-production privacy review has an owner and documented unresolved obligations; no blanket 'fully compliant' badge appears.
