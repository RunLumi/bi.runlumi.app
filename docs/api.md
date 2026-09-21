# API

All protected responses are private and non-cacheable. Requests use the fixed
installation resources configured in the Worker; no path or body selects a
database.

Core paths:

- `GET /api/setup/status`
- `POST /api/setup`
- `POST /api/auth/session`
- `GET /api/session`
- `GET|POST /api/users`, `PUT /api/users/:id`
- `GET|POST /api/sources`, `PUT /api/sources/:id`
- `GET /api/metrics`
- `POST /api/query`, `POST /api/query-batch`
- `GET|POST /api/imports`
- `GET|POST /api/dashboards`, `PUT /api/dashboards/:id`

The server validates role, schema, revision, source state, date windows, metric
IDs, query bounds, and snapshot provenance. Raw SQL, arbitrary HTML, and model
generated code are not accepted.
