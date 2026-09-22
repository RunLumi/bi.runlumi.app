# Lumi BI engineering contract

Lumi BI is one independently operated installation per repository. A request is
authenticated, authorized against local users and roles, and then uses the
fixed database and object-store bindings configured for that installation.

Never add a second-installation selector, request-selected database, central
registry, remote entitlement gate, fleet API, or request-time dependency on a
Lumi-operated service. Users, sessions, roles, source permissions, reports,
exports, jobs, and audit records are local application data.

Use prepared semantic plans with reviewed identifiers. Never accept raw SQL or
runtime model output as executable code. Unknown, stale, missing, or unverifiable
data remains unavailable; it is never silently converted to zero or success.

Keep customer customization in the customer repository and public composition
interfaces. Core packages are versioned build-time artifacts. Do not patch core
internals from an installation repository.

## Frontend is shadcn/ui on Tailwind

Build application UI with shadcn/ui on Tailwind v4. `@runlumi/ui` owns the shared
primitives under `src/components/ui` (Radix behavior, cva variants, `cn` from
`src/lib/utils`) and the shared screens; extend them there instead of styling
around them in an app. New components follow the shadcn recipe and the DESIGN.md
tokens — no bespoke CSS or one-off markup where a shadcn component already
applies. Brand differences are theme tokens (`--background`, `--primary`,
`--radius-*`, …), never forked components.

## API connectors are read-only

Interact with external API connectors only to pull or fetch data. Never put, update,
or create any data through API connectors — this includes inserts, upserts, updates,
deletes, and schema or configuration writes on the remote system. The only exception
is an explicit user request during development and operations, in which case do exactly
what was asked and nothing more.

Before completing a meaningful change, run the typecheck, focused installation
tests, repository checks, and the relevant browser or Worker check. Report what
was verified and what remains unknown. Never put secrets or real customer data in
Git.
