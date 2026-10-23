# Privacy and data-minimization threat model — local and remote AI modes

Companion documents: [WEB_SECURITY_BASELINE.md](WEB_SECURITY_BASELINE.md) holds the CI-enforced
web and child-safety controls; [CHILD_SAFETY_PRIVACY.md](CHILD_SAFETY_PRIVACY.md) holds the POC
data-minimization rules this threat model protects; [AI_OUTPUT_VALIDATION.md](AI_OUTPUT_VALIDATION.md)
covers the inbound (provider-output) validation boundary — this document covers the outbound
(what leaves the browser/device) side, per issue #103.

## Data-flow diagram

### Local mode (fake or Ollama runtime — `packages/provider-runtime`)

```
┌──────────────┐  program, runtime obs.,  ┌──────────────────┐
│ apps/web      │ ───── hint request ────▶ │ Ollama (localhost)│
│ (browser)     │                          │ or fake runtime    │
│               │ ◀──── hint response ──── │ (same device)      │
└──────┬───────┘                          └──────────────────┘
       │ program + metadata (no free text)
       ▼
┌──────────────┐
│ localStorage  │  (device-local only; nothing here leaves the device)
└──────────────┘
```

Nothing crosses a network boundary that leaves the device: Ollama's default
endpoint is `localhost`.

### Remote mode (OpenAI-compatible gateway — `apps/tutor-api`)

```
┌──────────────┐  TutorRequest             ┌──────────────┐  LearningCompanionRequest   ┌──────────────────┐
│ apps/web      │ ──── (browser→server) ──▶│ apps/tutor-api│ ── (server→provider) ─────▶│ remote provider    │
│ (browser)     │                          │ (server-side) │                             │ (OpenAI-compatible)│
│               │ ◀─── TutorResponse ───── │               │ ◀──── provider response ─── │                    │
└──────┬───────┘                          └──────┬───────┘                             └──────────────────┘
       │ program + metadata                       │ provider auth token (env, never
       ▼ (no free text)                            │ shipped to the browser bundle)
┌──────────────┐
│ localStorage  │
└──────────────┘
```

The browser never talks to the remote provider directly; `apps/tutor-api`
is the only component holding a provider credential
(`packages/provider-runtime`'s `OpenAICompatibleProviderRuntimeConfig.authToken`),
enforced by `security-baseline.mjs`'s `checkClientSecrets` rule (no
`AGORIX_TUTOR_API_KEY`-shaped identifier may appear in `apps/web` source).

### Optional private authenticated project mode

This is not required for the POC. If enabled by a deployment, account, session
and ownership data are stored as provider-neutral envelopes around the canonical
project:

```
┌──────────────┐  AccountIdentity, SessionIdentity, OwnedProjectDescriptor  ┌──────────────────┐
│ Web/Studio    │ ────────────────────────────────────────────────────────▶ │ account/project   │
│ surface       │ ◀──────────────── private project list / owned project ─ │ service           │
└──────┬───────┘                                                            └──────────────────┘
       │ StoredProject only
       ▼
┌──────────────┐
│ ProjectProgram│  (no account/session/ownership fields)
└──────────────┘
```

The service boundary must not push account IDs, session IDs, email addresses,
recovery contacts or ownership revisions into `ProjectProgram`.

## Per-data-class decisions

| Data class                                            | Needed?                                                                                                           | Processed where                                                             | Persisted?                                         | Logged?                                                                                                                                                                                                | Can leave device?                                                                                                                                            | Minimization                                                                                                                                                                                                     |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Canonical program (`ProjectProgram`)                  | Yes — is the learner's work                                                                                       | Browser (runtime/curriculum), sent to tutor-api/provider as request context | Yes, `localStorage` (`packages/persistence`)       | No first-party logging call exists in the repo (verified: `grep -rn "console\." apps/tutor-api/src packages/provider-runtime/src packages/persistence/src apps/web/src` returns nothing outside tests) | Yes, as part of a hint/proposal request payload, in remote mode only                                                                                         | Schema-validated shape only (`agorix/program/v1`); no free-form fields                                                                                                                                           |
| Runtime observations (`RuntimeObservation[]`)         | Yes — grounds debugger/hint facts in real execution                                                               | Browser (runtime), sent as request context                                  | No (in-memory only; not part of `ProjectMetadata`) | No                                                                                                                                                                                                     | Yes, in remote mode, as part of the request                                                                                                                  | Already structured/bounded (position, heading, step index — no raw stdout/exceptions)                                                                                                                            |
| Learner free text (`learnerIntent`/`learnerQuestion`) | Contract-supported, **not collected by the shipped POC UI** (no textarea/question box exists in `apps/web` today) | If/when added: browser → tutor-api                                          | Not persisted anywhere today                       | No                                                                                                                                                                                                     | **Stripped by default** — `apps/tutor-api`'s `toCompanionRequest` deletes `learnerIntent` unless `AGORIX_TUTOR_INCLUDE_LEARNER_QUESTION=1` is explicitly set | Server-side opt-in flag, not a client toggle; defaults closed                                                                                                                                                    |
| Proposal history (accept/reject decisions)            | Yes — needed for the accept/reject UI state                                                                       | Browser only (`App.tsx` component state)                                    | No — not part of `ProjectMetadata`; lost on reload | No                                                                                                                                                                                                     | No                                                                                                                                                           | Never leaves the component's in-memory state                                                                                                                                                                     |
| Persistence (`ProjectMetadata`)                       | Yes — resume progress across sessions                                                                             | Browser                                                                     | Yes, `localStorage`, device-local                  | No                                                                                                                                                                                                     | No                                                                                                                                                           | Exactly 5 fields: `createdAt`, `updatedAt`, `missionProgress` (number), `hintLevel` (number), `locale` (optional string) — see `packages/persistence/src/store.ts`. No name/id/contact field exists in the type. |
| Logs/telemetry                                        | No first-party logging/analytics infrastructure exists                                                            | N/A                                                                         | N/A                                                | N/A                                                                                                                                                                                                    | No                                                                                                                                                           | The absence of any logging sink is itself the current minimization — see "Logs allowlist/denylist" below for what a future logging feature must respect                                                          |
| Provider auth token                                   | Yes, for remote mode only                                                                                         | Server (`apps/tutor-api`), from environment                                 | No (env var, not persisted by the app)             | No                                                                                                                                                                                                     | No — never included in any request/response payload sent to the browser                                                                                      | `checkClientSecrets` fails the build if a provider-secret identifier appears in `apps/web` source                                                                                                                |
| Account identity (`AccountIdentity`)                  | Optional — private authenticated mode only                                                                        | Account/project service; surface receives opaque account state              | Yes, only when authenticated accounts are enabled  | Not by default; log opaque account ID only when operationally required, never child alias/contact                                                                                                      | Yes, between authenticated surface and service                                                                                                               | Opaque `accountId`, alias, status and timestamp only. Alias is not an email address and should not be a real name. Email is not mandatory.                                                                       |
| Session identity (`SessionIdentity`)                  | Optional — private authenticated mode only                                                                        | Account/project service and authenticated surface session store             | Short-lived session storage, not canonical project | No session IDs/tokens in logs                                                                                                                                                                          | Yes, between authenticated surface and service                                                                                                               | Opaque session reference, account binding and expiry only. No cookies, password hashes or HTTP headers in canonical domain contracts.                                                                            |
| Project ownership (`OwnedProjectDescriptor`)          | Optional — private authenticated mode only                                                                        | Account/project service; surfaces may wrap `StoredProject`                  | Yes, only in authenticated project storage         | Avoid titles in logs; prefer project ID/hash when correlation is required                                                                                                                              | Yes, between authenticated surface and service                                                                                                               | `projectId`, `ownerAccountId`, title, revision and timestamps are outside `ProjectProgram`; semantic project hash ignores this envelope.                                                                         |
| Recovery contact                                      | Optional deployment capability                                                                                    | Account service only                                                        | Yes, only if explicitly enabled and collected      | Never log raw contact values                                                                                                                                                                           | Yes, between authenticated surface and account service                                                                                                       | Not part of the default account contract. Requires documented purpose, retention and deletion behavior before collection.                                                                                        |

## Retention and deletion assumptions for authenticated mode

Anonymous/local POC projects remain device-local until the user or browser
storage policy deletes them.

If private authenticated accounts are enabled, account deletion must delete or
orphan user-owned project descriptors according to a documented product policy,
invalidate active sessions, and remove recovery contact data except for any
externally reviewed retention window. Deleting account identity must not require
rewriting `ProjectProgram`, because identity and ownership are stored outside
the canonical project.

The product must never collect real name, mandatory email, precise age, school,
home address, photo, public profile, advertising identifier or monetization
profile as a prerequisite for the POC learning flow.

## Logs allowlist / denylist

No logging or analytics sink exists in this codebase today (verified above).
If one is added, it must respect this denylist without exception, and the
allowlist is the complement:

**Denylist (must never be logged, anywhere, at any level):**

- `learnerIntent` / `learnerQuestion` (raw child free text);
- provider auth tokens or any `AGORIX_TUTOR_*_KEY`-shaped value;
- full `ProjectProgram` content (log a content hash if correlation is needed, not the program itself);
- raw provider request/response bodies.
- account aliases, recovery contacts, session IDs and raw ownership titles.

**Allowlist (safe to log, already structured/non-identifying):**

- `ProviderRuntimeDiagnostics` (`runtimeId`, `providerId`, `modelId`, `locality`, `capability`) — no secrets, no child content;
- `ProviderRuntimeErrorCode` values (`timeout`, `provider-error`, etc.) — enumerated, non-PII;
- mission id/version, hint level, `missionProgress` — already part of `ProjectMetadata`.

## Prompt injection / malformed provider output

Covered at the appropriate level by the existing inbound validation boundary
in [AI_OUTPUT_VALIDATION.md](AI_OUTPUT_VALIDATION.md) (issue #100): every
provider response — local or remote — passes through
`validateLearningCompanionResponse`/`validateLearningCompanionSafety` before
it can reach learner-facing UI or mutate the canonical program. This
threat model's scope is the outbound side (what the app sends and stores);
it does not duplicate #100's inbound schema/safety enforcement.

## Adult account and child device link (issue #514, epic #504)

New data and who can see it. Design: `docs/superpowers/specs/2026-10-23-kids-adult-link-design.md`;
controls: `AUTH_SECURITY.md`. The feature is off unless the server sets `AGORIX_LINK_SECRET` and the
`adultLink` web flag is on; local-only Kids is unchanged and makes no request to these routes.

| Data                                                                     | Where                                                                    | Who sees it                                                                               | Retention                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- | --------------------------------------------- |
| Adult email (normalised)                                                 | server, `agorix_adult_emails`                                            | the adult only; never returned to a device, never logged, never sent to Ori or a provider | until the adult deletes the account           |
| Email verification token                                                 | server, SHA-256 only                                                     | nobody (single use, 24 h)                                                                 | until used or expired                         |
| Link code                                                                | server, HMAC only; adult screen in memory only                           | the adult while it is on screen                                                           | 10 minutes, single use                        |
| Device link (id, created, last-seen **day**, sync flag)                  | server                                                                   | the adult                                                                                 | until unlinked; then 30 days                  |
| Device token                                                             | child device `localStorage` (`agorix.kids.link.v1`); server SHA-256 only | the device                                                                                | rotated on use; 60 d idle / 180 d absolute    |
| Progress summary (counts, 14 daily minute totals, age band, daily limit) | server                                                                   | the adult                                                                                 | replaced on each upload; 30 days after unlink |
| Per-day minutes history                                                  | child device, **only while linked**                                      | the device                                                                                | 14 days; cleared on unlink                    |

Never collected or sent: child name, location, project contents, Ori chat, images, audio, per-event
timestamps, IP address (the rate limiter hashes it in memory), user agent, device fingerprint.

Threats considered: code guessing (limits on failures per source and globally, 10 minute life, 3 live
codes per adult), token theft (hashed at rest, rotated, scoped to one link, revocable from either side),
email enumeration (same answer for taken and fresh addresses), cross-use of credentials (device routes
reject the adult cookie and adult routes reject device tokens), over-collection (strict summary schema,
8 KB body cap, pinned by tests), and orphaned data (30 day purge, immediate deletion with the account).

Open items: account deletion endpoint and screen, persistence of the guess counters across restarts,
and a legal review (COPPA, GDPR-K / Art. 8) before enabling this for real
families.

## Deviations

None. Every outbound field in the local- and remote-mode diagrams above is
justified in the per-data-class table; none carries name, school, exact
location, or contact data (satisfying `CHILD_SAFETY_PRIVACY.md`'s POC data
minimization rule).

Private authenticated mode is intentionally documented as an optional future
mode. It requires external product/legal/privacy review before production child
accounts; this threat model does not claim legal compliance.
