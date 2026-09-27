<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Deterministic Unit of Work

- Work: issue-92
- Pathway: documentation

## Objective

Define the runtime/provider boundary used by LearningCompanion capabilities without coupling Agorix domain code to any vendor SDK or model family.

## Scope

- Deliver the explicit source-issue objective within the governed Work.
- Preserve the source constraints and acceptance criteria without widening scope.

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
