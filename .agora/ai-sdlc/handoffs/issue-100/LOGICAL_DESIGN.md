# Issue 100 Logical Design

## Boundary Placement

The shared boundary is implemented in `@agorix/tutor-contract` as `validateLearningCompanionSafety(request, response)`. It first reuses existing request/response schema validators, then applies child-safety, scaffolding, ProgramProposal and provenance checks.

## Runtime Integration

`@agorix/provider-runtime` now validates successful fake, Ollama and OpenAI-compatible responses with `validateLearningCompanionSafety` before returning `ok: true`. Any safety failure is normalized as `invalid-response`, matching malformed structured output behavior.

## Failure Behavior

Rejected output returns provider-runtime failure diagnostics and does not expose raw provider content to learner UI. The accepted program object is not mutated by validation or rejection.

## Economics

The implementation uses deterministic local tests and mocked provider fixtures. No live provider call, credential or frontier model call is required.
