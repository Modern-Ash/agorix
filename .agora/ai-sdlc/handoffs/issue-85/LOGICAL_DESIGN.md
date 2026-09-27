# Issue 85 Logical Design

## Design

A new `learning-companion.ts` module is exported from `packages/tutor-contract/src/index.ts`. This keeps the existing tutor contract stable and adds the new capability contract beside it.

Validation is intentionally strict:

- request and response schema literals are required;
- unknown keys fail closed;
- capability metadata must match the response capability;
- provider-specific fields are rejected;
- builder payload validates the existing `@agorix/proposals` `ProgramProposal`;
- debugger payload validates facts separately from suggestions.

## Provider Neutrality

The contract contains no provider transport, credential or SDK fields. Provider adapters can call `assertLearningCompanionProviderContract` with any local or remote provider output and receive the same validation behavior.

## Authorship Boundary

Builder output cannot mutate canonical state. It is a `ProgramProposal` with `reviewState: proposed` and preview metadata. Proposal acceptance remains outside this issue.

## Evidence Boundary

Debugger output contains deterministic facts in `payload.facts` and model guidance in `payload.suggestions`. Tests assert that these are structurally distinct.
