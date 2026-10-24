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

## Adult email and child device link (`@agorix/link-service`)

Design: `docs/superpowers/specs/2026-10-23-kids-adult-link-design.md` (epic #504). This package sits
beside `auth-service`; it does not change how usernames, passwords or sessions work.

- **Adult email.** One address per account, normalised (trim, NFKC, lower-case; dots and plus tags stay
  distinct) and unique. Verification uses a 256-bit one-time token stored as SHA-256, valid 24 hours,
  single use, and bound to the address it was issued for (changing the address un-verifies it and old
  tokens stop working). Resends: 60 s cooldown and 5 per hour. An address that already belongs to
  someone else gets the same HTTP answer as a fresh one and the owner receives an "email in use" message
  instead, so the API does not reveal which addresses exist. The address is never returned to a device
  token, never logged and never sent to Ori or any provider; the API only reports `{present, verified}`.
- **Link code.** 6 digits from a CSPRNG (no modulo bias), valid 10 minutes, single use, at most 3 live
  codes per account (the oldest is revoked), stored only as an HMAC-SHA256 keyed with
  `AGORIX_LINK_SECRET`. A verified email is required to create one and is re-checked on redemption.
  Because the code is the only thing the child types, a failed guess cannot be attributed to one code,
  so the brute-force limits are on **failures**: 10 per source and 200 per whole server in a 10 minute
  window (then `429`); successful redemptions never count. SQLite/PostgreSQL store the source and
  global windows durably, so a server restart does not reset the budget. The scheduled retention
  sweep removes expired windows. The source is `X-Real-IP` set by nginx, hashed before storage; if
  it is absent every caller shares one bucket. Raw addresses are never stored.
- **Device token.** 256-bit random, stored as SHA-256, scoped to one link and unable to call any adult
  route (bearer only; the adult session cookie is not accepted on device routes and vice versa).
  Rotated on every use with a 60 second grace so a lost response does not strand the device; idle TTL
  60 days, absolute TTL 180 days. Revoked, expired, unknown and malformed tokens fail identically
  (`401`). The link record keeps only an id, creation time, last-seen **day** and the sync flag; no IP,
  user agent or fingerprint.
- **Summaries.** Strict schema (counts, 14 day minutes, age band, daily limit); anything else, any extra
  key and any body over 8 KB is rejected. Retention: 30 days after unlink (a scheduled purge, every 6
  hours), immediate on account deletion.
- **Operations.** The feature is off unless `AGORIX_LINK_SECRET` (at least 32 characters) is set. Mail
  goes through SMTP (`AGORIX_MAIL_SMTP_URL`, `AGORIX_MAIL_FROM`; see
  `docs/architecture/PROJECT_HTTP_SERVER.md`): TLS is mandatory and verified (implicit TLS, or STARTTLS
  with no downgrade), credentials are never written before TLS, delivery runs in the background so the
  HTTP answer cannot reveal whether an address exists, and logs carry only the failure kind. Without a
  transport the default `NoopMailer` drops messages.

## Proposed organizer capability for closed groups (ADR 0010, #556)

The `organizer` is a **capability of an existing adult account**, not a child account, a second
password system or the AI administrator. A verified adult email is necessary to request it but is
not sufficient to operate another person's group. F1 (#566) must persist the capability with
grant/revoke audit and enforce it in the server for every create, read, update, join approval,
expulsion and close operation. A revoked or unverified account loses group control immediately.

The adult-child device link from #504 grants only the existing summary and sync rights for that
linked device. It does not grant organizer authority over the linked child's peers; conversely, an
organizer may see only the current group's ephemeral alias, team and aggregate contribution, not
adult emails or another family's linked-device summaries. The AI administrator from #545 has no
group membership or moderation authority.

The group host has an ephemeral per-device key for each admitted slot and validates every input.
Join codes are short-lived and one-use; the organizer explicitly accepts each join. A family/friends
organizer records adult-consent attestations per child, while a school flow requires institution-level
authorization and notice. The legal/privacy review must approve those flows before group mode is
activated for real children. Group membership and device keys expire and are deleted on close;
precise retention and backup windows are F1 acceptance criteria.
