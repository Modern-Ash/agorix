# Issue 100 Domain Model

## Core Types

- `LearningCompanionRequest`: provider-neutral request containing sanitized mission, program, selected nodes, runtime facts, scaffold history and optional learner intent.
- `LearningCompanionResponse`: provider-neutral structured output from fake/local/remote adapters.
- `LearningCompanionSafetyDiagnostic`: non-PII diagnostic with `code`, `path` and `message`.
- `LearningCompanionSafetyValidationError`: fail-closed safety error carrying developer diagnostics and a safe child-facing message.

## Safety Codes

- `capability-mismatch`
- `over-assistance`
- `pii-request`
- `unsafe-program-proposal`
- `hidden-provider-action`
- `context-provenance-mismatch`

## State Authority

The canonical program remains unchanged until a validated `ProgramProposal` is reviewed and accepted by the learner. Provider output is never accepted program state.
