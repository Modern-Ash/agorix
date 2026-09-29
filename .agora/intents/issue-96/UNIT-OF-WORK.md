<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Deterministic Unit of Work

- Work: issue-96
- Pathway: brownfield

## Objective

Select providers by required pedagogical capability while keeping Agorix usable when no LLM is available.

## Scope

- Deliver the explicit source-issue objective within the governed Work.
- Preserve the source constraints and acceptance criteria without widening scope.

## Acceptance criteria

- capability-aware selection tested
- preferred provider unavailable -> documented fallback
- no compatible provider -> clear unavailable state
- offline mode does not call network
- canonical/runtime behavior unchanged
- child-facing copy avoids technical provider jargon by default
- developer diagnostics expose selected runtime/model safely.

## Constraints

- no compatible provider -> clear unavailable state

## Dependencies

- No explicit dependencies.
