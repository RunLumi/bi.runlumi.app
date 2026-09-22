# 8. Connect, import data and resolve import errors

There are two data domains with different contracts: **operational
snapshots** (workflow cost/capacity facts) and **commerce exports**
(sales, settlement, inventory evidence). Neither supports live vendor
connections: commerce data arrives as owner-authorized exports you upload.

## Register a source (operational)

In the app: **Nguồn & nhập** → *Đăng ký nguồn mới* (owner). Or
`POST /api/sources` `{id, name}` — ids are lowercase identifiers such as `ops`.

## Import an operational snapshot

In the app: **Nguồn & nhập** → *Nhập snapshot vận hành*. Required:

- source id; observed-through date (the source watermark);
- a unique idempotency key per upload (e.g. `ops-2026-W38`);
- a JSON array of 1–20 records:

```json
[{"recordId":"r1","day":"2026-09-20","workflow":"support","cases":3,
  "baselineMinutes":60,"humanMinutes":15,"runtimeCostVnd":1000,
  "supportCostVnd":500,"cashSavingsVnd":0,"cashEvidenceRef":null}]
```

Semantics: `cashSavingsVnd > 0` requires `cashEvidenceRef` (`CASH_EVIDENCE_REQUIRED`);
records after the watermark are rejected; a stale snapshot is rejected
(`STALE_SNAPSHOT`); the same key with different bytes is rejected
(`IDEMPOTENCY_CONFLICT`); replaying the same key with the same bytes returns
the original result (`replayed: true`). Raw bytes are stored immutably in R2
with a checksum.

**Nhanh.vn customer?** The [Nhanh.vn playbook](nhanh-vn-playbook.md) walks the
full loop for your store: which Nhanh UI exports to pull, how to map them to
the envelope below, and the reconciliation step before go-live.

## Register a commerce connection (owner)

In the app: **Commerce** → *Kết nối nguồn*. A connection binds one provider
account + resource type (`orders`, `settlements`, `inventory`) to the
`authorized-export` transport with your internal approval reference. Revoking
or pausing a connection immediately blocks its receipts and invalidates saved
publications that depend on it (`PUBLICATION_SOURCE_REVOKED`).

## Upload a commerce export

Export a bounded snapshot (≤48 KB JSON, ≤100 records, explicit window) from
your provider and POST the envelope (the UI's Commerce page assembles it):

```json
{"eventType":"snapshot","connectionId":"orders-export","sourceAccountId":"shop-A",
 "resourceType":"orders","deliveryId":"delivery-1","sourceObjectId":"delivery-1",
 "sourceRevision":null,"sourceEventAt":null,"sourceUpdatedAt":null,
 "window":{"from":"...","toExclusive":"..."},
 "schemaFingerprint":"sha256:...","rawJson":"{...}"}
```

The receipt is stored before any interpretation (`ACCEPTED`); replays with the
same bytes converge, conflicting bytes under the same delivery id fail with
409 and never rewrite evidence. A failed delivery can be re-run through the
normalization job (`Xếp hàng` → `Chạy`); jobs retry at most 3 times with a
60-second lease and then dead-letter with the receipt.

## Reading import errors

| Code | Meaning | Action |
| --- | --- | --- |
| `SOURCE_SCOPE_MISMATCH` | Account/resource doesn't match the connection | Fix the export's account or resource type |
| `DELIVERY_ID_CONFLICT` | Same delivery id, different bytes | Re-upload identical bytes or use a new delivery id |
| `QUARANTINED` (normalization) | Business content failed review | Fix at the source; do not edit evidence |
| `STALE_SNAPSHOT` | Older watermark than active snapshot | Import a newer snapshot |
| `CASH_EVIDENCE_REQUIRED` | Cash savings without evidence ref | Attach the evidence reference |
| `RECEIPT_SCOPE_UNAVAILABLE` | Connection paused/revoked | Restore the connection deliberately |

Quarantined evidence is retained and inspectable (owner, staging view) — it is
never silently zero-filled or dropped.

Continue to [Publish, query and use reports and decisions](09-publish-query-reports-decisions.md).
