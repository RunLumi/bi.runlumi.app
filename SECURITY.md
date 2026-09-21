# Security model

The security boundary is the installation. The Worker has one fixed D1 binding
and one private R2 binding; request parameters cannot select another database.

Authentication establishes a principal. The local user record establishes the
role and active state. Every protected route checks that record on the server.
Disabling a user revokes its sessions. Source disablement blocks new imports,
and saved results retain provenance and content hashes.

The first-run setup is one-time. Missing configuration, missing database,
invalid identity, expired session, disabled user, stale revision, invalid metric,
and unverifiable snapshot fail closed.

Use prepared SQL only, bounded request bodies and result sizes, private no-store
responses, cryptographic random session tokens, and WebCrypto hashing. Do not log
credentials, session tokens, raw customer rows, or source payloads.

Cloudflare account and IAM separation is an operational choice for the owner of
each installation. This repository does not claim that a Worker is a complete
account boundary.
