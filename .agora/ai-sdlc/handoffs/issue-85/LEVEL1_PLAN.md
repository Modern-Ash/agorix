# Issue 85 Level 1 Plan

## Intent

Evolve `@agorix/tutor-contract` from a hint-only tutor contract into a provider-neutral `LearningCompanion` capability contract. The implementation must preserve the existing deterministic hint behavior through a migration path while adding typed request/response coverage for coach, builder, debugger, explainer, challenger and reflector capabilities.

## Source Alignment

- GitHub issue: #85.
- Parent epic: #66.
- Product rule: AI proposes. Child decides. Runtime proves. Child explains.
- Architecture source: `docs/architecture/LEARNING_COMPANION.md`.
- Legacy migration source: `docs/architecture/AI_TUTOR.md`, `packages/tutor-contract`, `apps/tutor-api`, `apps/web`.

## Delivery Scope

1. Add Learning Companion schema versions, capability identity and shared request/response envelopes.
2. Model minimum context only: mission/version, learning objective, sanitized canonical program, selected node ids, runtime observations, hint/scaffolding history, learner intent and reading configuration.
3. Add capability payloads for:
   - coach/question;
   - bounded builder proposal;
   - evidence-grounded debugger;
   - explainer;
   - challenger/prediction;
   - reflector.
4. Define structured output validation that rejects malformed, provider-specific or unsafe fields.
5. Keep builder output distinguishable from canonical program state.
6. Keep debugger facts separate from model suggestions.
7. Provide deterministic fake responses for all required capabilities or explicitly staged subsets with test coverage.
8. Preserve backward migration from `TutorRequest`, `TutorResponse` and deterministic tutor hints.
9. Document architecture and migration notes.

## Out Of Scope

- Provider runtime negotiation for Ollama/OpenAI-compatible gateways; that belongs to #92 and later provider issues.
- UI proposal preview/diff acceptance; that belongs to #75 and #87.
- Full learning loop E2E; that belongs to #91.
- Privacy threat model expansion beyond this contract's data-minimization checks; that belongs to #103.

## Implementation Sequence

1. Contract shape: define Learning Companion types, schema constants and validators alongside legacy tutor exports.
2. Migration compatibility: adapt existing deterministic tutor hint helpers to the new coach/hint capability without breaking current consumers.
3. Capability payloads: add builder, debugger, explainer, challenger and reflector payload validation.
4. Fake provider: add deterministic fake Learning Companion responses for the required capability set.
5. Tests: add conformance-style tests for provider neutrality, malformed output, builder boundary, debugger evidence grounding, no child PII and no provider SDK dependency.
6. Docs: update package README and add architecture/migration note.
7. Verification: run targeted package tests, then repository test/build checks as practical.

## Handoff Boundary

Construction may begin only after Product Owner approval of this inception and developer approval for inception. Product Owner acceptance remains separate from deterministic tests.
