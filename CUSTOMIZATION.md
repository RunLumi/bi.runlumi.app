# Customization

An installation repository can replace pages, navigation, branding, dashboards,
server endpoints, metrics, connectors, analytical context, workflows, and tests.
Use the public interfaces exported by the versioned core packages. Keep custom
files outside installed package internals so a core update can preserve them.

Executable examples live in `examples/customers/` (distinct pages and server
metrics per customer), the starter ships a `/customer-note` page, and promoted
insight reports produce reviewed TSX under `customer/reports/`.

Custom server code runs with the installation's privileges and must enforce the
same role and source checks. A model may propose text or a semantic plan; model
output must never become executable JavaScript or SQL.

## Error monitoring

`createApi` accepts an optional `onError(error, context)` hook. Core reports
unexpected failures (non-`AppError` exceptions and `AppError`s with a 5xx
status, including their `request` and `requestId`) to the installation, which
decides where they go — an error tracker, a log drain or nowhere. Expected
request errors (4xx) stay handled responses and are never reported. Wire the
hook at the installation's Worker entry and bridge it to your tracker there;
its DSN or credentials are Cloudflare secrets, never Git contents.

See [user guide chapter 10](user-guide/10-customize.md) for the full walkthrough.
