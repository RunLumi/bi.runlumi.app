# 0011: Standalone customer authority

Status: accepted replacement for the retained managed-authority portions of ADR 0010.

## Decision

Each generated customer application owns its runtime authority and data plane. A
customer Worker has no required CONTROL service binding and makes no request-time
call to a Lumi-operated Worker, D1, license server, deployment registry, or runtime
approval service.

Customer-owned Access authenticates users. The serving D1 stores:

- local memberships and role state;
- local entitlement feature sets;
- serving identity and route fencing;
- customer audit records.

The shared core remains an upstream package release. It supplies reviewed contracts,
semantic query services, React components, migrations, and upgrade tooling. It does
not supply request-time authority.

## Consequences

- A customer can deploy into its own Cloudflare account and keep operating when
  Lumi-operated services are unavailable.
- Customer permissions and revocation are local and require customer operational
  ownership.
- Shared fleet administration, central licensing and multi-tenant cell routing are
  outside the standalone customer deployment.
- A local authority outage fails closed.
- TypeScript/React customer code remains trusted application code and is not a
  security sandbox.

## Verification

The generated customer Worker omits CONTROL, customer tests seed local authority
records, and the two-customer acceptance proves fresh installation, local tests,
custom TSX compilation, upgrade preservation, and independent rollback. Live
customer-owned Access and Cloudflare-account certification remain external evidence.
