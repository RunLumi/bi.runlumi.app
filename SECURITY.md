# Security model

The security boundary is the installation. The Worker has one fixed D1 binding
and one private R2 binding; request parameters cannot select another database.

Authentication accepts either a local session cookie (direct email + password
sign-in; passwords are stored as salted PBKDF2-SHA-256, 210k iterations) or, if
the operator configured it, a verified Cloudflare Access JWT matched to a local
user. The local user record establishes the role and active state. Every
protected route revalidates the session server-side. Disabling a user revokes
its sessions immediately, revoking a commerce source closes its published data
and exports, and saved results retain provenance and content hashes. The last
active owner can never be disabled or demoted through the application.

The first-run setup is one-time and closes permanently after success; the
singleton installation row makes concurrent initialization choose exactly one
winner, and an optional `SETUP_TOKEN` secret protects the setup window against
takeover. Demo identity headers exist only in the local demo server and are
never read in a production composition. Missing configuration, missing database,
invalid identity, expired session, disabled user, stale revision, invalid metric,
and unverifiable snapshot fail closed.

Use prepared SQL only, bounded request bodies and result sizes, private no-store
responses, cryptographic random session tokens, and WebCrypto hashing. Do not log
credentials, session tokens, raw customer rows, or source payloads.

Cloudflare account and IAM separation is an operational choice for the owner of
each installation. This repository does not claim that a Worker is a complete
account boundary.
