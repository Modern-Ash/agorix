# Issue 100 Deployment Unit

## Changed Runtime Units

- `@agorix/tutor-contract`: shared Learning Companion safety validation types and `validateLearningCompanionSafety` boundary.
- `@agorix/provider-runtime`: fake, Ollama and OpenAI-compatible success paths now use the shared safety boundary before returning `ok: true`.
- `docs/safety/AI_OUTPUT_VALIDATION.md`: security-oriented validation matrix and review checklist.

## Deployment Characteristics

- No runtime credentials or provider configuration changes are required.
- No browser secret exposure is introduced.
- Unsafe provider output now fails closed as `invalid-response`.
- Canonical program state remains unchanged after rejection.

## Rollback

Revert the issue #100 changes in `packages/tutor-contract`, `packages/provider-runtime`, and `docs/safety/AI_OUTPUT_VALIDATION.md`. Existing provider schema validation remains as the previous fallback if this deployment is rolled back.
