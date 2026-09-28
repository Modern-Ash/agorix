# Issue 95 Domain Model (brownfield semantic elevation)

Elevation of the legacy real-LLM tutor domain in `apps/tutor-api` into the
provider-neutral `LearningCompanion` / provider-runtime domain established by
issues #85, #92, #93 and #94.

## 1. Legacy domain being migrated

`apps/tutor-api/src/index.ts` is the only place in the repository that performs
a real remote model call. It owns:

- `TutorProviderKind = "fake" | "openai-compatible"` — a protocol name in a domain union.
- `TutorProviderConfig` with `endpoint`, `apiKey`, `timeoutMs`, `includeLearnerQuestion`.
- `callOpenAiCompatibleProvider` — `POST` with `authorization: Bearer`, `response_format: json_object`,
  system prompt, minimal context projection, `AbortController` timeout.
- `fallback` — deterministic `createDeterministicTutorResponse` on
  `not-configured | timeout | provider-error | invalid-response`.

## 2. Target domain

`packages/provider-runtime/src/index.ts` is the provider-neutral authority:

- `LearningCompanionProviderRuntime` — `descriptor` / `health` / `negotiate` / `request`.
- `ProviderRuntimeDescriptor` — `runtimeId`, `providerId`, `modelId`, `locality`,
  `features`, `contextLimits`, `capabilities`. No vendor or protocol field.
- `ProviderRuntimeErrorCode` — `unsupported-capability | timeout | cancelled | not-configured |
  authentication-failed | provider-unavailable | provider-error | invalid-response`.
- `ProviderRuntimeRequestOptions` — `timeoutMs`, `cancelled`.
- `createOpenAICompatibleProviderRuntime` — the protocol adapter (`baseUrl`, `modelId`,
  `capabilities`, `authToken`, `authHeaderName`, `timeoutMs`, injected `fetch`).
- `assertProviderRuntimeConformance` — shared conformance check.

No commercial vendor name, product name or model default belongs in any of these types.

## 3. Issue #27 scope disposition

| #27 constraint | Legacy home | Disposition | Target home |
| --- | --- | --- | --- |
| Secret stays server-side; never reaches browser or source | `AGORIX_TUTOR_API_KEY` via `configFromEnv` | **preserved** | `apps/tutor-api` remains the only env reader; `authToken` is injected at that boundary only |
| Real remote HTTPS model call with bearer auth | `callOpenAiCompatibleProvider` | **migrated** | `createOpenAICompatibleProviderRuntime` |
| Request validation before any provider call | `validateTutorRequest` | **preserved** | `validateLearningCompanionRequest` (tutor-contract) |
| Response validation before anything is trusted | `parseTutorResponse` | **preserved** | `validateLearningCompanionResponse`; failure becomes `invalid-response` |
| Timeout and cancellation | `AbortController` + `setTimeout` | **preserved** | `timeoutMs` on config, `ProviderRuntimeRequestOptions.cancelled` |
| Minimal context, no child PII beyond mission scope | `toMinimalTutorContext` | **preserved** | provider-runtime request mapping |
| Deterministic fallback on unconfigured / timeout / provider error / invalid response | `fallback` | **migrated** | `ProviderRuntimeErrorCode` + `createFakeProviderRuntime` / `createDeterministicLearningCompanionResponse` |
| No credentials needed for build, tests or default run | `fake` default | **preserved** | `createFakeProviderRuntime` stays the default path |
| Provider identity is an implementation detail, not product authority | `TutorProviderKind` union | **superseded** | free-form `providerId` / `modelId` on the descriptor |
| `unavailableReason` diagnostic vocabulary | `TutorProviderDiagnostics` | **superseded** | `ProviderRuntimeErrorCode` |
| Hardcoded default endpoint and default commercial model | `DEFAULT_ENDPOINT`, `gpt-4o-mini` | **superseded** | configurable `baseUrl` / `modelId`; no commercial default is compiled in |
| Structured JSON response format on the wire | `response_format: json_object` | **migrated** | OpenAI-compatible adapter request body |

## 4. Semantic elevation rules

1. `TutorProviderKind` and any protocol name disappear from domain types; protocol
   identity lives only in adapter implementation and adapter selection.
2. Commercial providers are **optional adapters**, never a default, never a dependency,
   never a named preference in product or docs copy.
3. A `not-configured` / `timeout` / `provider-unavailable` result must be
   observably equivalent to the legacy fallback path: the learner still receives a
   deterministic companion response, and curriculum/runtime semantics are unchanged.
4. Provider output is never canonical program state. Any programming suggestion
   re-enters through `ProgramProposal` validation before canonical mutation.
5. `authToken` and any secret stay on the server boundary; a browser or client
   bundle must be unable to obtain them, in default or configured mode.

## 5. Brownfield debt to retire in this work unit

- `apps/tutor-api` must stop owning its own HTTP/timeout/parse implementation and
  delegate the remote path to provider-runtime, keeping only env reading,
  fallback and the server boundary.
- Legacy `TutorRequest` / `TutorResponse` usage at the provider call site must map
  onto the `LearningCompanion` contract without duplicating validation.
