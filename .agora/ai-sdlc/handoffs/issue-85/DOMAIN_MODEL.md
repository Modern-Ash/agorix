# Issue 85 Domain Model

## Package Boundary

`@agorix/tutor-contract` remains the domain contract package for learning support. The package now exposes a provider-neutral Learning Companion model while preserving legacy `Tutor*` exports for existing consumers.

## Core Types

- `LearningCompanionRequest`: versioned request envelope with capability, mission, canonical program, selected node ids, optional runtime context, runtime facts, scaffold history, learner intent and reading configuration.
- `LearningCompanionResponse`: discriminated response union for `coach`, `builder`, `debugger`, `explainer`, `challenger` and `reflector`.
- `LearningCompanionMetadata`: capability identity, scaffold level, provenance and uncertainty.
- `LearningCompanionRuntimeFact`: deterministic runtime fact with id, optional observation index, optional node id and fact text.

## Capability Payloads

- Coach returns a scaffolded question.
- Builder returns `ProgramProposal` with `reviewState: proposed`, validation and preview metadata.
- Debugger returns `facts` separated from `suggestions`.
- Explainer returns an explanation payload.
- Challenger returns a prediction prompt.
- Reflector returns a reflection prompt.

## Migration Model

- `createLearningCompanionRequestFromTutorRequest` adapts existing tutor hints to coach capability.
- `createTutorResponseFromLearningCompanionResponse` supports legacy consumers while surfaces migrate.
