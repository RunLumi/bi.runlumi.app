# API surface 0.1

All `/api/*` routes require verified identity. Tenant routes resolve active
membership and validate selected database identity. Private responses use
`Cache-Control: private, no-store`. Role checks execute on the server.

| Method and path | Role | Behavior |
| --- | --- | --- |
| GET `/healthz` | Public | Process alive; explicitly not production-ready |
| GET `/api/session` | Authenticated | Membership-filtered tenant list in this cell |
| GET `/api/tenants/:tenant/metrics` | Viewer+ | Metric catalog, no executable SQL |
| POST `/api/tenants/:tenant/query` | Viewer+ | Strict semantic request, bounded result + lineage |
| GET `/api/tenants/:tenant/dashboards` | Viewer+ | Dashboard definitions |
| GET `/api/tenants/:tenant/dashboards/:id` | Viewer+ | One definition or 404 |
| POST `/api/tenants/:tenant/dashboards` | Editor+ | Create `{id, definition}`; revision starts at 1 |
| PUT `/api/tenants/:tenant/dashboards/:id` | Editor+ | Full definition; `If-Match: "<revision>"` required |
| POST `/api/tenants/:tenant/imports` | Owner | Registered-source bounded snapshot; `Idempotency-Key` required |
| GET `/api/tenants/:tenant/imports` | Viewer+ | Recent metadata; no R2 download capability |

Bodies must be JSON and at most 64 KiB. API mutation requests reject cross-origin
browser requests. There is no wildcard CORS, raw SQL endpoint, source-credential
endpoint, export URL, anonymous embed or runtime management endpoint.

Production identity: a validated Access JWT with expected issuer/audience,
RS256 signature, expiry and subject. Tenant membership is a separate database
check, not assumed from Access login alone. Local synthetic demo identities live
only in `scripts/local-adapters.mjs`.

Important response codes: 400 contract error, 401 unauthenticated, 403 forbidden,
409 stale revision/idempotency conflict/stale snapshot, 413 oversized body,
415 incorrect MIME, 422 budget/quota, 428 required revision, 503 missing/mismatched
trusted deployment configuration. Errors contain a code and request ID, never a
raw database message, source row or token.

A replayed successful import returns its original snapshot ID and `replayed:true`.
A reused idempotency key with a different normalized payload is a conflict. The
normalized row order is currently part of the payload checksum.
