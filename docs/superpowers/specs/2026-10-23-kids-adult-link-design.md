# Agorix Kids: adult account and child link code (design, no code)

Status: **approved by the product owner on 2026-10-23** (decisions below). Tracks issue #471 under epic #436;
implementation is split into the issues linked from the epic created for it.

## Why

Prototype v2 (HANDOFF 6c "Cuentas y franja de edad") shows an adult account (email + password) that
generates a 6-digit code the child types at onboarding ("Tengo un código de mi adulto") to link the
device. The prototype stores everything locally. A real version touches child privacy, so it needs a
design first.

## What exists

- `packages/auth-service`: username/password, scrypt, opaque sessions with token hashes, rate limits,
  generic failures (`docs/safety/AUTH_SECURITY.md`).
- `apps/web/src/accounts`: optional sign-in, project sync, conflict dialogs (epic #349, issues
  #346/#347/#358).
- `docs/safety/CHILD_SAFETY_PRIVACY.md`: no real name, mandatory email, precise age, school,
  address, photo or public profile; authenticated child designs must document data, purpose,
  retention and deletion.
- Today the child needs no account and the adults panel is a local arithmetic gate.

## Goals

- An adult can see a linked child device's progress summary and settings from another device.
- The child never creates an account, never types an email, name or location.
- Linking is simple enough to do at a kitchen table.

## Non-goals

- Child profiles, avatars or any child text on the server.
- Public sharing (ADR 0009), classroom/teacher mode, payments.

## Design

### Actors and data

| Item             | Where                   | Notes                                                                                                                                                   |
| ---------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adult account    | server (`auth-service`) | alias or email chosen by the adult; email optional. Reuses existing policy.                                                                             |
| Device link      | server                  | opaque `linkId`, `accountId`, `createdAt`, `revokedAt`. No child data.                                                                                  |
| Link code        | server, short-lived     | 6 digits, hashed (HMAC with server secret), expires in 10 minutes, single use.                                                                          |
| Progress summary | optional sync           | the same aggregates the adults panel shows (missions done, concept counts, daily minutes). Never events with timestamps, never free text, never images. |
| Age band, limits | adult settings          | already local; synced only after link and only as the setting value.                                                                                    |

### Flow

1. Adult signs in on their device, chooses "Link a child device", server creates a pending link and
   shows a 6-digit code with a 10-minute countdown.
2. On the child device, the adult (not the child) opens Adults, passes the gate and enters the code.
3. Server verifies the hash and expiry, marks it used, issues the device a **device token** (random
   256-bit, stored hashed server-side; device keeps it in `localStorage`).
4. The device may then sync the allowed aggregates; the adult sees them. Unlinking from either side
   revokes the token.

### Security

- **Brute force:** 10^6 codes. Limit 5 attempts per code and 10 per source per 10 minutes; a code is
  invalidated after 5 failures; generate a fresh code to retry. Uniform "invalid or expired" error.
- Codes single use, 10 minutes, generated with a CSPRNG, never logged, stored hashed.
- Device token revocable, rotated on use like sessions, scoped to the link only (cannot read the
  adult account).
- Unlink deletes server-side summaries for that link within 30 days (target: immediately).
- CSRF/CSP/headers follow `docs/safety/WEB_SECURITY_BASELINE.md`.

### Privacy and compliance notes

- Data minimisation: the child is represented by an opaque link, not a person. Do not collect age
  (only a band the adult chooses), name, school, location or photos.
- COPPA (US) and GDPR-K / Article 8 (EU): parental consent is inherent because the adult creates and
  controls the account; keep a short privacy notice, a deletion path (unlink + delete account) and a
  retention limit. This section is a design note, not legal advice: get a legal review before launch.
- The local-only mode stays fully supported; linking is optional.

### Failure modes

- Offline: linking needs network; everything else keeps working. Sync retries silently.
- Lost device: adult revokes the link from the account.
- Clock skew: expiry is judged server-side only.

## Decisions (2026-10-23, product owner)

1. **Email is required** for the adult account (not just alias + password). Consequences: the email is
   normalised and unique, verified with a one-time confirmation link before a child device can be
   linked, never shown to the child device, never sent to Ori or any provider, and deleted with the
   account. This applies to the adult only; the child still gives no email, name or location. The
   "no mandatory email" line in `CHILD_SAFETY_PRIVACY.md` is about children and gets a clarifying note.
2. **Progress sync is in the first release.** Only the aggregates the adults panel already shows
   (missions done, concept counts, daily minutes, Ori decision counts). No timestamps per event, no
   free text, no images, no project contents. The adult can switch sync off per linked device.
3. **Retention: 30 days after unlink.** Summaries of an unlinked device are kept 30 days so the adult
   can still read them, then deleted by a scheduled job. Deleting the adult account deletes everything
   immediately. Link codes and device tokens are never kept past their own expiry/revocation.

## Implementation issues

1. Server: link and code endpoints with rate limits and hashed codes (tests for brute force, expiry,
   reuse).
2. Server: device token issue/rotate/revoke.
3. Web: adult "Link a child device" UI and code display.
4. Web: Adults "Enter code" flow on the child device.
5. Sync: summary upload and adult dashboard (only if question 2 is yes).
6. Docs: update `CHILD_SAFETY_PRIVACY.md` and the privacy notice.
