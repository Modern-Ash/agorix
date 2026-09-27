# @agorix/tutor-contract

Provider-neutral Learning Companion contracts and legacy tutor compatibility helpers.

The package keeps the historical `Tutor*` request/response API available for current Web and `tutor-api` consumers, but new work should use the `LearningCompanion*` capability contract. The package remains domain-only TypeScript: no React, Blockly, Phaser, Capacitor, VS Code APIs or provider SDK dependencies.

## Learning Companion capabilities

The contract models six pedagogical capabilities:

- `coach`: asks scaffolded questions or hints.
- `builder`: returns a reviewable `ProgramProposal`; it never returns accepted canonical state.
- `debugger`: separates deterministic runtime facts from suggestions.
- `explainer`: explains concepts, code or evidence.
- `challenger`: asks the learner to predict, compare or justify.
- `reflector`: helps the learner explain what changed and why.

All provider output should enter through `parseLearningCompanionResponse` or `assertLearningCompanionProviderContract`. Unknown provider-specific fields fail closed.

## Migration path

Use `createLearningCompanionRequestFromTutorRequest` to adapt existing tutor hints to the `coach` capability, and `createTutorResponseFromLearningCompanionResponse` while legacy surfaces still expect `TutorResponse`.

Provider adapters can be local fake, local model or remote model implementations as long as they return the same structured domain schema.
