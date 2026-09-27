<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Deterministic Requirements

## Objective

Define the runtime/provider boundary used by LearningCompanion capabilities without coupling Agorix domain code to any vendor SDK or model family.

## Requirements

- No separate requirements section; acceptance criteria remain authoritative.

## Acceptance criteria

- domain contracts compile without vendor SDKs
- at least two fake adapters with different capability sets pass tests
- capability mismatch is explicit
- timeout/cancel/error behavior normalized
- local and remote adapters use same interface
- provider/model can be changed through configuration
- architecture documents dependency direction.

## Constraints

- No explicit constraints.

## Dependencies

- No explicit dependencies.
