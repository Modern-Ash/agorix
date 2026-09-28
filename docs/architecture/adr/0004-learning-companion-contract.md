# ADR 0004: Learning Companion Capability Contract

## Status

Accepted for issue #85 construction.

## Context

Agorix is moving from a narrow optional tutor model to a provider-neutral Learning Companion. The product rule is: AI proposes. Child decides. Runtime proves. Child explains. Existing `Tutor*` consumers still need a migration path.

## Decision

Add a versioned `LearningCompanionRequest` and `LearningCompanionResponse` contract to `@agorix/tutor-contract` while preserving legacy `Tutor*` exports. The new contract includes capability identity, scaffold metadata, minimal learning context and capability-specific payloads for coach, builder, debugger, explainer, challenger and reflector.

Builder output uses the existing `@agorix/proposals` `ProgramProposal` model with `reviewState: proposed`, so consumers cannot confuse a proposal with accepted canonical state. Debugger output separates `facts` from `suggestions`, and facts reference supplied deterministic runtime evidence.

The contract stays provider-neutral. Provider names, credentials, raw provider metadata, SDK response fields and transport concerns remain outside domain packages.

## Consequences

- Existing tutor hint behavior can migrate through adapter helpers.
- Provider adapters can be local fake, local model or remote model implementations without changing the domain schema.
- Malformed or provider-specific output fails closed before reaching UI consumers.
- Later issues can build richer UI and provider runtime negotiation on top of this contract.
