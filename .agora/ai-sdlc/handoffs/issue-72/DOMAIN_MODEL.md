# Domain Model - Issue #72

## Concepts

- CanonicalProgram: versioned, serializable learner program state and the only accepted program authority.
- LanguageProjection: readable code view derived from CanonicalProgram with stable node-to-text mapping.
- RuntimeEvidence: deterministic observations, errors, completion facts and state transitions produced by runtime.
- ProgramProposal: structured proposed change that is validated and previewed before learner decision.
- LearningCompanion: provider-neutral coaching/proposal/debugging/explanation contract.
- ProviderAdapter: server-side/local boundary that calls a model implementation without leaking provider details.

## Invariants

- AI proposes; the learner decides; runtime proves; the learner explains.
- Blocks, displayed code and language views derive from CanonicalProgram.
- ProgramProposal is data, not accepted program state.
- CanonicalProgram mutates only after learner acceptance or learner modification.
- Runtime executes CanonicalProgram, not raw provider output or displayed generated code.
- RuntimeEvidence grounds AI debugging and explanations.
- Domain contracts stay independent from UI frameworks, platform APIs and provider SDKs.
