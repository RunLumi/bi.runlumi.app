# 0009: Source-available product with explicit integration boundaries

Status: accepted by owner instruction for repository adoption. Date: 2026-09-20.
Supersedes the original-product licensing paragraph of ADR 0005, not its historical
engineering rationale. Legal chain-of-title and signed-contract review are separate.

## Decision

Use unmodified Elastic License 2.0 for the existing original product and docs.
Reserve Apache-2.0 for explicitly reviewed thin SDK/client/starter scopes; the
current approved scope list is empty because those separate components do not
exist yet. Preserve all third-party notices and package publication safeguards.
Use separately negotiated rights for qualifying hosted-service/OEM partners.

The model is source-available, not OSI-approved open source, and is per-component,
not `Elastic-2.0 OR Apache-2.0` for the entire product. Existing control code does
not secretly become proprietary. Future private modules need separate delivery
and terms; they cannot retract rights already granted for published revisions.

## Why and tradeoffs

Merchants can inspect and privately customize their internal applications while
Lumi protects against unlicensed hosted services exposing substantial product
functionality. Ordinary consulting/installation and permitted redistribution
remain possible. ELv2 neither bans every competitor nor requires upstream sharing.
A stricter blanket noncompetition rule would be a different licensing decision.

This balances customer maintainability with managed-service economics, at the
cost of not offering OSI-approved licensing. Dependable operations, integrations
and reconciliation still need to earn the business; the license is not a moat
by itself. Customer confidentiality and IP allocation need separate agreements.

## Implementation and verification

Root LICENSE is the exact standard ELv2 text; NOTICE preserves current RunLumi
attribution without inventing a legal-entity assignment. LICENSING.md and the
usage/commercial/contribution policies clarify active scope and unresolved rights
review. All three package manifests and lock roots use Elastic-2.0, keeping
`private: true`. Web builds include original-product terms beside existing
third-party notices. The offline licensing gate rejects text drift, inconsistent
metadata, unknown package scope and silent Apache additions; it is not legal
clearance. No runtime entitlement, auth, deployment, visibility or dependency
version changes are part of this decision.

See [LICENSING.md](../../LICENSING.md), [rights review](../licensing/rights-review.md)
and the [commercial framework](../licensing/commercial-framework.md). Keep a
versioned record of future grants rather than rewriting historical releases.
