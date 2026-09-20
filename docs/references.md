# Primary reference register

Checked 2026-09-20. Documentation can change; recheck exact product status, account
limits and CLI behavior before adopting a feature. The architecture decisions are
ours; the product facts below come from official sources.

| ID | Official source | Decision it informs |
| --- | --- | --- |
| CF-01 | https://developers.cloudflare.com/workers/static-assets/ | Worker + static application asset delivery in one deployment |
| CF-02 | https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/ | Pages/Workers distinction and migration path, not a forced migration |
| CF-03 | https://developers.cloudflare.com/d1/platform/limits/ | Per-database limits, concurrency and per-tenant scale-out suitability |
| CF-04 | https://developers.cloudflare.com/d1/worker-api/d1-database/ | Binding API and batch transaction semantics |
| CF-05 | https://developers.cloudflare.com/r2-sql/ | Optional Iceberg analytical query layer; open beta at review date |
| CF-06 | https://developers.cloudflare.com/queues/reference/delivery-guarantees/ | At-least-once delivery and idempotent consumer requirements |
| CF-07 | https://developers.cloudflare.com/workflows/build/workers-api/ | Durable step orchestration for future ingestion |
| CF-08 | https://developers.cloudflare.com/kv/concepts/how-kv-works/ | Eventual consistency: do not use KV as authorization truth |
| CF-09 | https://developers.cloudflare.com/hyperdrive/ | External database connectivity, not a warehouse database |
| CF-10 | https://developers.cloudflare.com/hyperdrive/concepts/query-caching/ | Caching defaults and freshness implications |
| CF-11 | https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/ | Access JWT validation boundary |
| CF-12 | https://developers.cloudflare.com/d1/reference/migrations/ | D1 migration tooling; staged validation required |
| CF-13 | https://developers.cloudflare.com/d1/reference/time-travel/ | Recovery is a product-specific procedure, not an automatic full backup |
| JS-01 | https://registry.npmjs.org/typescript/5.8.3 | Exact development dependency version, license and integrity |
| CI-01 | https://api.github.com/repos/actions/checkout/git/ref/tags/v4.2.2 | Checked full action SHA |
| CI-02 | https://api.github.com/repos/actions/setup-node/git/ref/tags/v4.4.0 | Checked full action SHA |

## Selected factual constraints

D1 paid databases are limited to 10 GB each, are inherently single-threaded per
database and cap bound query parameters at 100. These constraints inform small
serving marts and bounded imports rather than a warehouse claim. Do not confuse
account database count with safe cell blast radius. See CF-03.

R2 SQL is marked open beta at this review date. This repository contains no
implemented R2 SQL connector and promises no compatibility beyond tested adapters.
See CF-05.

Queues and workflow retries require deduplication and safe publication semantics.
Neither service grants exactly-once effects across R2/D1/customer APIs. See CF-06/07.

## Reference-learning policy

Do not maintain a giant list of fashionable repositories. For a real adoption,
record the exact version/commit, license, problem solved, transferable lesson,
nontransferable assumptions, cheapest experiment and implementation owner. A
reference is not a dependency approval. Keep research subordinate to customer
feedback and reproducible evidence.
