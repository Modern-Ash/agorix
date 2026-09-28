<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Deterministic Unit of Work

- Work: issue-78
- Pathway: brownfield

## Objective

Create a browser-level test that proves the core transparency invariant end to end.

## Scope

- Deliver the explicit source-issue objective within the governed Work.
- Preserve the source constraints and acceptance criteria without widening scope.

## Acceptance criteria

- test fails if proposal auto-applies
- test fails if code is hidden during proposal/execution
- test fails if highlight cannot map through canonical node id
- test proves reject is side-effect free
- test proves accepted proposal executes deterministically
- stable in CI.
- test fails if code becomes inaccessible on tablet
- tablet portrait and landscape are both covered
- orientation/viewport change preserves canonical state
- no hover/right-click dependency is required.

## Constraints

- deterministic fake provider
- no network/real LLM credential
- no arbitrary sleeps
- assert canonical/base hash where practical
- desktop + narrow viewport
- retain trace/screenshots on failure.
- no hover/right-click dependency is required.

## Dependencies

- No explicit dependencies.
