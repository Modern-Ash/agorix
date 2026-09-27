# Issue 95 Logical Design

Product Owner decision (2026-09-27): **Option A**. `apps/tutor-api` delegates the
remote call to the existing `createOpenAICompatibleProviderRuntime` from
`@agorix/provider-runtime` (issue #94). No `createCommercialProviderRuntime`
layer is created, and no provider-specific factory is added anywhere.

## 1. Decision

| Item | Decision |
| --- | --- |
| Remote provider path | `createOpenAICompatibleProviderRuntime` (existing, issue #94) |
| New commercial provider factory | none |
| New adapter package | none |
| Commercial provider identity in code | none; identity is deployment configuration only |
| Domain-level provider types added | none |

## 2. Rationale

1. The protocol adapter already exists and already owns HTTP, auth headers,
   timeout, cancellation, response parsing, capability negotiation and error
   normalization. A second factory in front of it would duplicate that logic and
   create two places to keep correct.
2. A commercial provider is a *deployment*, not an architecture element. Under
   Option A a commercial deployment is expressed as `baseUrl` + `modelId` +
   `authToken` on the existing adapter, so adding a vendor requires no code,
   no review of vendor SDKs, and no domain change.
3. Keeping the boundary in `apps/tutor-api` preserves the server-side secret
   boundary: the environment reader stays in the app, `authToken` is injected
   at that single point, and domain packages stay free of vendor identity.
4. Rejecting Option B (`createCommercialProviderRuntime`) and Option C (a
   per-vendor adapter package) avoids dead abstractions that would have to be
   maintained before any learner-visible value exists.

## 3. Component responsibilities

| Component | Owns | Must not own |
| --- | --- | --- |
| `packages/provider-runtime` | `LearningCompanionProviderRuntime`, descriptors, `ProviderRuntimeErrorCode`, conformance, protocol adapters (`openai-compatible`, `ollama`, `fake`) | secrets, env reading, canonical program state |
| `apps/tutor-api` | server boundary: env/config parsing, adapter selection, `TutorRequest` <-> `LearningCompanion` mapping, deterministic degradation, diagnostics | HTTP calls, wire formats, timeouts, response parsing, vendor names |
| `packages/tutor-contract` | request/response validation, `createLearningCompanionRequestFromTutorRequest`, `createTutorResponseFromLearningCompanionResponse`, deterministic responses | provider selection |

## 4. Request flow

```text
learner interaction
  -> TutorRequest
  -> validateTutorRequest                       (tutor-contract)
  -> createLearningCompanionRequestFromTutorRequest
  -> privacy projection: drop learnerIntent unless explicitly opted in
  -> validateLearningCompanionRequest           (inside the adapter)
  -> POST {baseUrl}/chat/completions            (provider-runtime adapter)
  -> validateLearningCompanionResponse          (adapter)
  -> createTutorResponseFromLearningCompanionResponse
  -> TutorResponse
```

Failure path (any step):

```text
ProviderRuntimeResult.ok === false  (or missing configuration)
  -> TutorAdapterDiagnostics { source: "fallback", errorCode: <ProviderRuntimeErrorCode> }
  -> deterministic fake runtime, capability "coach"
  -> createTutorResponseFromLearningCompanionResponse
```

The degraded response is produced by the same deterministic provider runtime the
local adapter uses, so local and degraded results are byte-identical. This is the
one deliberate learner-visible change against the legacy code: the deterministic
coach copy now comes from the provider-neutral Learning Companion contract
(`"What should happen first when you run this program?"`) instead of the legacy
tutor copy. One deterministic voice, identical for local and degraded paths, and
no learner-facing divergence between adapters. `createDeterministicTutorResponse`
remains only as an unreachable last-resort guard if the deterministic runtime
itself ever fails validation. `tutor-api` has no consumer in the repository yet,
so no rendered copy changes today.

There is no path from a remote provider response to canonical program state.
`TutorResponse` carries only `hintLevel`, `message`, `nodeIds`, `concepts`; it
has no proposal or mutation field, so the legacy surface cannot express a
program change at all. Builder proposals exist only on the Learning Companion
surface and only as `ProgramProposal` values that pass
`packages/proposals` validation before any canonical mutation.

## 5. Configuration surface

Server-side environment only. No defaults name a commercial vendor, endpoint or
model.

| Variable | Meaning | Default |
| --- | --- | --- |
| `AGORIX_TUTOR_ADAPTER` | adapter selection: `fake` or `openai-compatible` | `fake` |
| `AGORIX_TUTOR_BASE_URL` | gateway base URL, without `/chat/completions` | unset |
| `AGORIX_TUTOR_MODEL` | model identifier sent on the wire | unset (required for remote) |
| `AGORIX_TUTOR_AUTH_TOKEN` | bearer/header token; stays server-side | unset (local gateways need none) |
| `AGORIX_TUTOR_AUTH_HEADER` | header name for the token | `authorization` |
| `AGORIX_TUTOR_TIMEOUT_MS` | request timeout | `4000` |
| `AGORIX_TUTOR_CAPABILITIES` | comma-separated capability list the selected provider must serve | `coach` |
| `AGORIX_TUTOR_INCLUDE_LEARNER_QUESTION` | `1` sends learner free text to the provider | unset (excluded) |

Unknown adapter values and unknown capability names are rejected at
configuration time with `TutorAdapterConfigurationError`; the capability list is
compile-checked against `LearningCompanionCapability` with `satisfies`, so it
cannot drift into vendor or product-specific values.

Compatibility: `AGORIX_TUTOR_PROVIDER` (legacy adapter value), `AGORIX_TUTOR_ENDPOINT`
(legacy full URL) and `AGORIX_TUTOR_API_KEY` are accepted as deprecated aliases
for `AGORIX_TUTOR_ADAPTER`, `AGORIX_TUTOR_BASE_URL` and `AGORIX_TUTOR_AUTH_TOKEN`
respectively. A legacy endpoint URL is reduced to its base by dropping a trailing
`/chat/completions`. Aliases exist so that no deployment breaks on upgrade; they
are adapter/protocol aliases, not vendor identity.

Missing `baseUrl` or `model` for a remote adapter is `not-configured`, which
degrades exactly like the legacy "no api key" fallback: the learner still
receives a deterministic companion response.

## 6. Superseded app-surface types

| Legacy | Replacement | Reason |
| --- | --- | --- |
| `TutorProviderKind` (`"fake" \| "openai-compatible"`) | `TutorAdapterKind`, same values | a protocol name was exposed as a domain union; it is now adapter selection in the app only |
| `TutorProviderConfig` | `TutorAdapterConfig` | `endpoint` -> `baseUrl`, `apiKey` -> `authToken`, plus `capabilities` and `authHeaderName` |
| `TutorProviderDiagnostics.unavailableReason` | `errorCode: ProviderRuntimeErrorCode`, `runtimeId`, `providerId` | one provider-neutral vocabulary instead of a second one |
| `callOpenAiCompatibleProvider` | `createOpenAICompatibleProviderRuntime` | HTTP/timeout/parse retired from the app |
| `DEFAULT_ENDPOINT`, `gpt-4o-mini` | none | no commercial default compiled in |

## 7. Safety invariants enforced by this design

1. No credential is required for build, tests, or the core learning flow: the
   default adapter is the deterministic fake runtime.
2. Secrets enter only through `AGORIX_TUTOR_AUTH_TOKEN` at the app boundary, are
   passed to the adapter, and are never echoed into diagnostics, thrown errors,
   fixtures, or logs.
3. Provider output is validated as a `LearningCompanionResponse` before use;
   malformed output becomes `invalid-response` and degrades.
4. Capability negotiation is explicit: an unsupported capability fails with
   `unsupported-capability` and never silently produces a different response.
5. Curriculum and runtime semantics are unchanged when switching adapters,
   because the request mapping and the response mapping are the contract and the
   runtime is the canonical program model.

## 8. Test obligations (detail in TEST_STRATEGY.md)

- deterministic success through an injected `fetch` for the remote adapter;
- `not-configured` when the remote adapter lacks `baseUrl` or `model`;
- `authentication-failed`, `provider-unavailable`, `provider-error`,
  `invalid-response`, `timeout`, `cancelled`, `unsupported-capability`;
- learner free text excluded unless opted in;
- no secret in diagnostics;
- fake adapter passes the shared conformance harness with no credentials.

## 9. Documentation deltas

- `docs/providers/OPENAI_COMPATIBLE_GATEWAY.md`: add a "commercial deployments"
  section describing configuration only, plus extension guidance for the next
  adapter and a fix for the `AG_ORIX_GATEWAY_TOKEN` typo.
- `docs/architecture/LEARNING_COMPANION.md`: reference the tutor-api delegation
  and the `tutor-api` environment table.
- `README.md`: keep provider-neutral wording; no vendor is named as preferred.
