# 13. Troubleshooting and operational handoff

## Error codes and recovery

| Code | Where | Meaning and first action |
| --- | --- | --- |
| `INSTALLATION_ALREADY_INITIALIZED` | setup | Setup closed permanently. Sign in instead. |
| `SETUP_TOKEN_REQUIRED` | setup | Deployment expects the `SETUP_TOKEN` secret; supply it or clear the secret if intentional. |
| `INSTALLATION_DATABASE_UNAVAILABLE` | all | `DB` binding missing at runtime. Check `wrangler.jsonc` and deployment target. |
| `INSTALLATION_STORAGE_UNAVAILABLE` | all | `SOURCES` R2 binding missing. Check binding names — they are fixed. |
| `UNAUTHENTICATED` / `SESSION_EXPIRED` | any | No/old session cookie. Sign in again. |
| `USER_DISABLED` | sign-in | Account disabled by an owner. An owner re-enables it. |
| `INVALID_CREDENTIALS` | sign-in | Email or password wrong; no account-existence oracle is given. |
| `LAST_ACTIVE_OWNER` | user management | Create a second owner before changing this one. |
| `CROSS_ORIGIN_DENIED` | writes | Cross-site form post. Use the app (same-origin) or an authorized server-to-server client. |
| `OWNER_REQUIRED` / `EDITOR_REQUIRED` | owner/editor surfaces | Sign in with a higher-privileged account. |
| `RECEIPT_SCOPE_UNAVAILABLE` | commerce | Connection paused/revoked or receipt revoked. Restore deliberately. |
| `PUBLICATION_SOURCE_REVOKED` | commerce reads/exports | Evidence depends on a revoked source. Restore the source or accept the data is closed. |
| `JOB_LEASE_HELD` | commerce jobs | Another runner holds the 60 s lease. Retry after it expires. |
| `JOB_RETRY_EXHAUSTED` | commerce jobs | Job dead-lettered after 3 attempts; inspect `lastError`, fix the source export, re-enqueue. |
| `RAW_EVIDENCE_*` | normalization | Retained bytes missing or checksum mismatch — investigate R2 integrity, never patch data. |

## Diagnostics

- `GET /healthz` — process and release version; requires no auth.
- `GET /api/setup/status` — initialization state.
- Audit history: `audit_events` records setup, users, sources, dashboards and
  every commerce state change with actor and timestamp.

## Known boundaries (repeat deliberately)

- No live provider connectors; authorized exports only.
- No bank reconciliation; `unreconciled_payout_amount` is a gap indicator, not
  recovered cash.
- Findings are advisory; nothing executes external actions.
- Demo headers authenticate nothing outside the local demo server.

## Operational handoff checklist

1. Repository: committed `lumi.lock.json`, `vendor/`, environment inventories,
   customer code; CI green on the delivered commit.
2. Secrets: `SETUP_TOKEN` set (or deliberately unset), Access vars if used —
   stored in the operator's secret manager, never in Git.
3. Schema: all installation migrations applied to each environment's D1;
   recorded backup restored and tested.
4. Access: at least two active owners; viewer/editor accounts provisioned.
5. Backups: `wrangler d1 export` scheduled (cron or operator runbook) and one
   restore exercised against staging.
6. Handoff run: sign-in, user creation, source import, publication, export
   demonstrated on the production hostname with the incoming operator.
7. Update path: the incoming operator can run `npm run upgrade -- --check`
   and knows the rollback limits (chapter 12).
