# Architecture

```text
Browser -> installation Worker -> local user/session authority
                         -> fixed D1 database
                         -> private R2 source archive
                         -> typed semantic query plan
```

The repository contains shared TypeScript/React packages and a generated
installation application. One installation owns one Worker, one D1 database and
one private R2 bucket per environment. There is no runtime database router,
central authority, fleet API, or request-time remote configuration.

The installation schema stores users, sessions, sources, immutable snapshots,
active snapshot pointers, workflow facts, dashboards, audit events, bounded jobs,
and reviewed business records. Business dimensions such as stores, channels and
warehouses are ordinary source data inside that database.

Metrics are reviewed code. The query compiler accepts typed metric IDs, dates and
dimensions, then emits prepared SQL with bounded results. Every result includes a
snapshot vector, content hashes, a quality state, and a context hash.
