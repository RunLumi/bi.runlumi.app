# Tenant packs: implemented operator-authored subset

Target owner: [C20](specs/commerce/20-gitops-and-tenant-packs.md).
The current JSON schema is `schemaVersion: 1`, `semanticVersion: operations-v1`.
It is deliberately smaller than the end-state C20 layout.

## Author and compile

`examples/tenant-pack/` contains synthetic declarative source. Edit `pack.json`
and a relative prompt file, then:

```bash
npm run pack:build -- examples/tenant-pack .local/reviewed-pack.json
```

The compiler resolves local text only, bounds bytes, rejects escaped paths and
unknown fields, validates seven known metrics/three widget kinds, and never
executes tenant scripts, SQL, imports or model calls. It is not a GitHub publisher.
Production shared-pack dependencies, metric ASTs, source mappings and lock DAGs
are not implemented; `latest` or arbitrary imports are not accepted.

## Trusted registration

An operator explicitly provisions `(tenant, repository, source_path)` in
`pack_sources`, outside interactive tenant authoring. The API accepts an
operator-authenticated `{repository, sourcePath, sourceCommit, pack}` and checks
that registry, schemas and hash. Source commit is immutable for that tenant.

**Provenance is `operator-asserted`, `attestationVerified: false`.** A 40-character
commit string is not evidence the code came from GitHub or was reviewed. This
P0 path supports Lumi-operated bundles; it must not be advertised or connected as
a production unattended GitOps/OIDC workflow. C20 publisher identity, immutable
file manifest, source attestation and semantic-finance review remain blockers.

The stored bundle is immutable private R2 content. Candidate metadata and activation
pointers are currently in central control D1; C20's target tenant-local deployment
metadata is deferred. The control service still has no access to commerce D1s.

## AI profiles

Only opaque references are accepted. An **enabled** profile must exactly match an
active `(tenant_id, provider_instance_ref, model_ref, credential_ref)` registry
entry. The registry contains no actual secrets or arbitrary endpoints. Validation
runs at registration, activation and active-bundle load. A revoked or foreign
reference fails closed. Disabled profiles contain inert placeholders.

No code in this release executes inference or resolves the credential into a key.
The daily budget is configuration, not enforced billing. Do not claim AI is active
because `enabled` is true. Prompts cannot change metric arithmetic or authority.

## Activate, inspect, roll back

Activation requires an operator, a currently allowed `git.publish` feature, tenant
active state, `If-Match` configuration revision, and `{releaseId, routeEpoch, reason}`.
It reloads/hash-checks the bundle, revalidates compatibility/profile references and
atomically updates the pointer only while expected revision and route epoch match.

Rollback is the same activation of an older compatible bundle using the **current**
revision/epoch. It does not restore data, undo migration, recreate a deleted secret,
send actions or change previous model charges. Cross-data-schema rollback is not
implemented; only the current static operations semantic contract is supported.

Git-managed assets are read-only through UI mutation APIs. UI may create a new
local copy; it does not change the active Git bundle. Two UI editors require a
strong revision match. Dashboard query-batch requests pin configuration revision
and release as well as the known data snapshot vector.

## Access boundaries

Clients cannot provide D1 IDs, R2 bucket names, tenant reassignment, provider URLs,
secrets or executable code. A shared internal config repo is suitable for Lumi staff.
Customer collaboration needs a separate private repository per confidentiality
boundary, not CODEOWNERS as a substitute for access control.
