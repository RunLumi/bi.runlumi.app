# Security boundaries and release gates

Status: development bootstrap. No real customer data is approved by this document.

## Trust flow

Verified Access principal -> active control-plane membership -> server binding
registry -> tenant DB identity guard -> role -> bounded semantic action -> tenant
D1/R2 -> minimized audit/result. The production entry has no demo flag or fallback.

Never accept `X-Tenant-ID`, a hostname, a model argument or a job payload as proof
of authority. A public shell may contain no customer data; all data APIs enforce
authorization independently of CDN/Access routing.

## Access identity verifier

The included verifier implements a narrow Cloudflare Access RS256 boundary using
WebCrypto, a fixed configured issuer/audience and a fixed issuer JWKS URL. Token
headers cannot choose a key URL or algorithm. It checks signatures, timestamps,
subject and claims, uses bounded caching and rejects missing configuration.

This is not a generic identity SDK or a claim of audited JWT correctness. The
bootstrap's tests use generated RSA keys. Live Access tokens, key rotation,
revocation, clock skew and runtime behavior still require staged validation and
security review. Evaluate a maintained JOSE library if the identity surface grows.
Do not weaken signature checks to make local setup easier.

Unknown keys fail closed until the short JWKS cache refreshes. This is an
availability tradeoff to avoid attacker-triggered fetch amplification; test it
against actual rotation behavior before customer deployment.

## Threats covered by local tests

Cross-tenant ID guessing, accidental binding swap, role bypass, revoked membership,
raw SQL injection, malformed queries, forged identity claims, invalid signatures,
stale dashboard updates, duplicate ingestion, stale snapshot publication, failed
R2 writes and atomic database rollback.

## Threats not solved by those tests

A compromised Worker has access to its cell bindings. A compromised Cloudflare
account may cross cells. The code does not provide per-tenant compute isolation,
an HSM, hardened customer credential brokerage, full export governance, rate-limit
admission, production DDoS economics, or organization-wide compliance.

Database-per-tenant is a useful boundary, not a claim of PostgreSQL RLS or complete
isolation. There is no complete enterprise IAM/SSO admin product in the bootstrap.

## Source and query controls

Only owner-authorized imports from registered sources are accepted. Imported JSON
is data, never instructions. No arbitrary source URLs are fetched. Future connector
work must address SSRF, redirects, private network access, scoped credentials,
source schema changes and deletion semantics.

Dashboards never execute SQL/HTML/JS. No model output reaches a SQL driver directly.
API responses are private/no-store. Future query caches must key by permission and
snapshot identity, not merely query text or tenant header. Exports, sharing links,
embeds, AI retrieval and queued jobs require new negative isolation tests.

## Secrets, evidence and backups

No real rows, credentials, JWTs, source exports or customer config inventory in Git.
No raw query-result logging. R2 remains private; do not enable public bucket access
to make downloads work. Object prefixes are routing conventions, not independent
IAM protection. An authorized download broker is a separate feature.

Snapshots are not a complete disaster-recovery policy. Restores need tenant D1,
control membership, source objects and deployment inventory to agree. Test restore
with one tenant while proving other tenants are unaffected. Deletion/retention
must cover source evidence, derived facts, caches and backups with documented
customer obligations; an immutable-history slogan must not defeat deletion duties.

## Required before a customer canary

1. Run this code and migrations in workerd/Wrangler, then real isolated staging D1/R2.
2. Validate Access JWTs/key rotation, direct-origin denial, membership revocation,
   viewer/editor/owner and cross-tenant tests against real bindings.
3. Confirm static-asset routing, CSP and absence of public data/cache leakage.
4. Exercise concurrent writes, query/ingestion quotas, retries and CPU/row budgets.
5. Add request rate limiting/admission, failure telemetry and billing alerts.
6. Exercise migration, previous-release rollback and tenant restore.
7. Record deployment token scope, source retention/location decisions and incident owner.
8. Only then import approved minimal customer data. Do not open anonymous sharing.

Stop release on any cross-tenant access, false-success publication, arbitrary SQL,
secret exposure, invalid signature acceptance or nonpositive benefit presented as
positive payback. Report suspected vulnerabilities through an authorized private
RunLumi channel, not public issues with customer evidence attached.
