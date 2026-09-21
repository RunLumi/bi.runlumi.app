# Cloudflare deployment choices

Use one Worker with Static Assets, one D1 binding named `DB`, and one private R2
binding named `SOURCES`. Staging and production use separate ordinary Wrangler
environment configuration. Secrets are configured with Wrangler secret storage,
never committed to Git.

The Worker uses in-process bindings rather than Cloudflare management API calls
for request handling. Heavy analytical work stays bounded; asynchronous jobs
must be idempotent, checkpointed, and auditable.
