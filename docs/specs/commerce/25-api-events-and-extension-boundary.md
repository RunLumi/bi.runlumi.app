# C25 — Public API, events and compatibility

Spec: C25 | Status: Target protocol, not an assertion of existing routes | Stage: P0 internal versioned contracts; P1 public read API; P2 integrations

Owns: cross-client/service envelopes, API conventions and compatibility. Domain payload meaning remains in its owning spec; duplicating metric or action definitions here is prohibited.

## API groups

| Group | Target operations | Authority and canonical owner |
|---|---|---|
| Identity/tenants | list authorized tenants, memberships, route status | C01; never enumerate all tenants to a normal user |
| Connections | initiate install, inspect coverage, reauthorize, pause, disconnect | C02–C05; authorized integration role |
| Data health | sync jobs, quality checks, coverage and reconciliation cases | C08; scope-filtered evidence |
| Catalog | metrics, dimensions, definitions, versions, lineage | C09; hide inaccessible metadata |
| Queries | execute typed plan, batch dashboard evaluation, inspect/cancel async job | C10; row/column/metric scope |
| Dashboards/packs | drafts, revisions, preview, publish, releases | C18/C20; publication separate from edit |
| Intelligence | ask, investigate, cases, decisions, feedback | C16/C17; same query authority |
| Delivery | schedules, notifications, exports, shared access | C19; recipient authorization |
| Actions | validate proposal, request review, dispatch, observe outcome | C21; no BI-token execution authority |
| Usage/billing | entitlements, usage, limits and contract status | C24; financial/admin role |

Route names should be frozen in implementation OpenAPI only when backed by code. Proposed namespaces use `/api/v1/...`; they must not be advertised as current bootstrap endpoints until implemented.

## Contract

- **C25-R01:** authenticated principal and membership precede resource resolution. Tenant route, IDs, background job payloads and service tokens are requests for a scope, not proof of it.
- **C25-R02:** side-effecting internal writes use idempotency keys scoped to tenant/principal/operation and a request-body digest. Reusing a key with different content returns conflict; it cannot silently replay a different action.
- **C25-R03:** revisions use ETag/If-Match or an equivalent optimistic version. Publish/disconnect/approval changes require current authority and prevent lost updates.
- **C25-R04:** pagination cursors are opaque integrity-protected values bound to tenant, scope, query hash, data version and expiry. Arbitrary database cursors/table names are not API inputs.
- **C25-R05:** amounts serialize as exact decimal strings with currency/scale; IDs as strings; timestamps as RFC3339 UTC plus explicit business timezone/date where needed. Null, zero, missing, forbidden and estimated are distinct.
- **C25-R06:** API evolution is additive only when semantics remain compatible. Breaking metric meanings, security scopes, pagination consistency or event behavior requires a version/migration, not silent reuse of a field name.

## Common response context

Return request_id, contract_version, authorized scope description/digest, data/semantic versions where relevant, source coverage/freshness, result status, warning/error codes and traceable evidence references. Do not echo secrets, hidden fields or raw user-supplied SQL in errors.

Error classes: AUTH_REQUIRED, ACCESS_DENIED, SOURCE_AUTH_EXPIRED, SOURCE_APPROVAL_REQUIRED, SOURCE_RATE_LIMITED, SCOPE_PARTIAL, DATA_NOT_READY, DATA_STALE, DATA_REMOVED, METRIC_UNAVAILABLE, UNSUPPORTED_CAPABILITY, QUERY_BUDGET_EXCEEDED, REVISION_CONFLICT, INVALID_CONTRACT, AS_OF_UNAVAILABLE and INTERNAL_ERROR. User guidance should distinguish retry, reauthorize, provide data, revise request or contact operator.

## Jobs and events

Long work returns a durable job ID, not a request kept alive indefinitely. Job states include QUEUED, RUNNING, WAITING_SOURCE, RETRY_PENDING, NEEDS_INPUT, SUCCEEDED, PARTIAL, FAILED, CANCELLED and EXPIRED. Cancellation fences new work; already completed external effects follow their own contract.

Event envelope: event_id, schema_version, tenant_id, aggregate_type/id, aggregate_revision, event_type, occurred_at, observed_at, causation_id, correlation_id, payload_ref and producer_version. Raw PII/credentials are not placed in pub/sub payloads. Consumers authenticate producer, reauthorize tenant/resource and dedupe event identity. Ordering guarantees are explicit per aggregate where implemented; Queues is not assumed ordered.

Internal service bindings are preferred to unauthenticated public endpoints. Browser progress SSE/WebSocket subscriptions reauthorize and expire; they cannot continue streaming after revocation indefinitely. Notification receipt is not proof a consumer performed an action.

## External tooling

MCP/read tools, embedded BI clients and Lumi Agents consume the governed query/catalog API, not shared D1 management credentials. Tools expose read-only typed schemas and bounded results. Remote configuration cannot add an arbitrary SQL/execution tool. Plugin/source packages declare provenance, compatibility and capability scopes; actual dependencies retain licenses independently of the repository's private code license.

## Acceptance

- **C25-A01:** replay identical idempotent write returns the same logical result; changed payload under the same key is rejected.
- **C25-A02:** an A cursor reused for B, another scope or another snapshot fails verification.
- **C25-A03:** long ID and large exact monetary values survive JSON serialization without precision loss.
- **C25-A04:** old supported client interprets new optional fields safely; incompatible semantics return explicit unsupported-version behavior.
- **C25-A05:** revoked subscription cannot continue receiving sensitive events beyond the documented authority window.
- **C25-A06:** MCP/agent credentials cannot query raw tables, another tenant or perform operational mutations through the BI API.
