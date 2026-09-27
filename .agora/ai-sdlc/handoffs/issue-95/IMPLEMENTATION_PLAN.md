# Issue 95 Implementation Plan

Traces the approved plan (LEVEL1_PLAN.md, BOLTS.md) and logical design
(LOGICAL_DESIGN.md) to the landed change on branch
`feat/issue-95-commercial-provider-adapters` (commit `03f037b`).

## 1. Objective

Move every real-LLM concern out of the Learning Companion app surface and behind
the provider-adapter boundary, so that the commercial path is optional,
credential-free by default, and vendor-neutral.

## 2. Change units

| # | Unit | Layer | Files | Status |
| --- | --- | --- | --- | --- |
| B1 | Adapter selection and configuration surface | app boundary | `apps/tutor-api/src/index.ts` | done |
| B2 | Delegation to provider runtime with error-code mapping | app boundary | `apps/tutor-api/src/index.ts` | done |
| B3 | Deterministic test coverage for success and failure paths | tests | `apps/tutor-api/src/index.test.ts` | done |
| B4 | Gateway configuration and extension documentation | docs | `docs/providers/OPENAI_COMPATIBLE_GATEWAY.md`, `docs/architecture/SYSTEM_DESIGN.md`, `README.md` | done |

All code units are server-side (`apps/tutor-api`). No domain package imports a UI
framework, provider SDK, browser, Capacitor or VS Code API; the only new runtime
dependency is the provider-neutral contract already landed by issues 92-94.

## 3. B1 - configuration surface

Derive `TutorAdapterConfig` from environment only:

- `AGORIX_TUTOR_ADAPTER` (default `fake`), `AGORIX_TUTOR_BASE_URL`,
  `AGORIX_TUTOR_MODEL`, `AGORIX_TUTOR_AUTH_TOKEN`, `AGORIX_TUTOR_AUTH_HEADER`,
  `AGORIX_TUTOR_TIMEOUT_MS` (default `4000`),
  `AGORIX_TUTOR_CAPABILITIES` (default `coach`),
  `AGORIX_TUTOR_INCLUDE_LEARNER_QUESTION` (unset means excluded).
- Deprecated aliases `AGORIX_TUTOR_PROVIDER`, `AGORIX_TUTOR_ENDPOINT`,
  `AGORIX_TUTOR_API_KEY` keep existing deployments working; a legacy endpoint is
  reduced to its base by dropping a trailing `/chat/completions`.
- Unknown adapter or capability values raise `TutorAdapterConfigurationError` at
  configuration time. The capability list is checked with `satisfies
  LearningCompanionCapability[]`, so it cannot drift into vendor values.
- `TutorProviderKind`, `TutorProviderConfig`, `DEFAULT_ENDPOINT` and the compiled
  `gpt-4o-mini` default are removed from the app surface.

## 4. B2 - runtime delegation

- Build a provider request from the mission context and the canonical program
  snapshot only; provider output is never executed or merged into program state.
- `callOpenAiCompatibleProvider` is removed; the app calls
  `createOpenAICompatibleProviderRuntime` through the shared provider-runtime
  contract, so HTTP, timeout and parse handling live in one adapter.
- Diagnostics expose `errorCode: ProviderRuntimeErrorCode`, `runtimeId` and
  `providerId` instead of a second provider-specific vocabulary. `TutorProviderDiagnostics.unavailableReason`
  is retired.
- Capability negotiation is explicit: an unserved capability fails with
  `unsupported-capability`.
- Missing `baseUrl`/`model` for a remote adapter is `not-configured`, degrading
  exactly like the previous missing-key fallback, so the learner still gets a
  deterministic companion response.
- Learner free text is sent only when
  `AGORIX_TUTOR_INCLUDE_LEARNER_QUESTION=1`.
- The auth token is read at the boundary, passed to the adapter, and never
  echoed into diagnostics, thrown errors, fixtures or logs.

## 5. B3 - tests

`apps/tutor-api/src/index.test.ts` runs the shared conformance harness against
the fake adapter with no credentials, plus the remote path through an injected
`fetch`. Covered paths are listed in TEST_STRATEGY.md.

## 6. B4 - documentation

- `docs/providers/OPENAI_COMPATIBLE_GATEWAY.md`: configuration-only
  "commercial deployments" section, extension guidance for the next adapter, and
  the `AG_ORIX_GATEWAY_TOKEN` typo fix.
- `docs/architecture/SYSTEM_DESIGN.md`: pointer to the tutor-api delegation.
- `README.md`: provider-neutral wording; no vendor is named as preferred.

## 7. Sequencing and verification

1. Land the configuration surface, then delegation, then tests, then docs, in
   separate commits where separable.
2. Verify with the narrow tutor-api test target and the repository typecheck and
   lint commands; no provider credential is present in the environment.
3. Record successful `test-suite` and `repository-change` evidence, then satisfy
   the source-issue criterion to `verified` and request the developer approval
   for the `construction-verified` gate.

## 8. Out of scope

- New provider adapters beyond `openai-compatible` (issue 94 already landed the
  gateway adapter; issue 93 the Ollama adapter).
- Persisting learner conversation history or any child personal data.
- Any UI change; the companion surface is unchanged.
