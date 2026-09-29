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

## Logs allowlist / denylist

No logging or analytics sink exists in this codebase today (verified above).
If one is added, it must respect this denylist without exception, and the
allowlist is the complement:

**Denylist (must never be logged, anywhere, at any level):**

- `learnerIntent` / `learnerQuestion` (raw child free text);
- provider auth tokens or any `AGORIX_TUTOR_*_KEY`-shaped value;
- full `ProjectProgram` content (log a content hash if correlation is needed, not the program itself);
- raw provider request/response bodies.

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

## Deviations

None. Every outbound field in the local- and remote-mode diagrams above is
justified in the per-data-class table; none carries name, school, exact
location, or contact data (satisfying `CHILD_SAFETY_PRIVACY.md`'s POC data
minimization rule).
