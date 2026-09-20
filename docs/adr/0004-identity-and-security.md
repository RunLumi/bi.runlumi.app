# 0004: Pilot identity with independent tenant authorization

Status: accepted for bootstrap, production validation pending. Date: 2026-09-20.

## Decision

Use Cloudflare Access for the controlled pilot's identity boundary. The Worker
verifies issuer/audience/signature/time/subject, then separately checks database
membership. No trusted user header, fallback tenant or runtime demo-auth flag.

The implementation uses standard WebCrypto RSA verification and a fixed configured
JWKS endpoint, not token-chosen keys/URLs. It is narrowly scoped, tested with generated
keys and explicitly requires real Access/rotation review. A maintained identity
library should be evaluated before broader OIDC/SaaS login requirements are added.

## Tradeoff

This is suitable to validate a small invite-only operator/customer pilot, not a
finished public self-service identity system. Access onboarding/account cost and
customer email/SSO needs must be confirmed before productizing sign-up. Changing
the identity adapter must not weaken membership, role or tenant routing checks.

## Release gate

Real-token validation, wrong-issuer/audience denial, direct route protection,
revocation, key rotation, roles, dedicated-resource needs and cross-tenant probes
must be verified in staging. Source CF-11 in [references](../references.md).
