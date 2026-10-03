# Auth Security Boundary

Companion documents: [CHILD_SAFETY_PRIVACY.md](CHILD_SAFETY_PRIVACY.md) defines the child-account
privacy constraints and [PRIVACY_THREAT_MODEL.md](PRIVACY_THREAT_MODEL.md) defines account/session
data minimization for optional authenticated mode.

`@agorix/auth-service` is a provider-neutral service boundary for username/password sign-in
and secure sessions. It is intentionally separate from project persistence, UI, extension code,
HTTP handlers and external identity providers.

## Scope

- Usernames are normalized with `@agorix/platform-contract` `normalizeAccountAlias`.
- Passwords are accepted only at register/sign-in boundaries and are never persisted in plaintext.
- Password records use Node's built-in `crypto.scrypt` KDF with a per-account random salt.
- Public failures use typed `AuthPublicError` codes. Internal storage or KDF failures are not part
  of the public error surface.
- Sessions use opaque random tokens. Stored session records keep token hashes, expiry metadata and
  revocation state, not bearer tokens.
- The package exports SQL repositories and migrations for PostgreSQL/SQLite through a minimal
  executor boundary. Domain records stay vendor-neutral.

## Required Controls

- `register` validates username and password policy, rate limits attempts and rejects duplicate
  normalized usernames.
- `signIn` returns a generic invalid-credentials error for unknown accounts, bad passwords and
  inactive accounts.
- `resolveSession` enforces absolute expiry, idle expiry and account-active checks. It rotates
  session tokens by default and invalidates the previous token.
- `signOut` revokes the current token hash.

## HTTP Integration Requirements

If a deployment exposes browser cookie sessions, the HTTP layer must set session cookies as
`HttpOnly`, `SameSite=Lax` or stricter for same-site flows, and `Secure` in production. Browser
storage such as `localStorage` must not hold session tokens. Mutating authenticated requests must
use CSRF protection appropriate to the chosen cookie architecture.

## Deployment Notes

The package ships deterministic in-memory repositories for tests and local wiring only. Production
storage can use the exported SQL repositories or provide compatible `AccountRepository` and
`SessionRepository` implementations with durable unique constraints, encrypted-at-rest storage,
audit logging and retention/deletion behavior reviewed with privacy and product owners before child
accounts are enabled.
