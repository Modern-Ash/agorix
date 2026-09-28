<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Deterministic Unit of Work

- Work: issue-77
- Pathway: brownfield

## Objective

Make execution causality inspectable without exposing raw developer logs.

## Scope

- Deliver the explicit source-issue objective within the governed Work.
- Preserve the source constraints and acceptance criteria without widening scope.

## Acceptance criteria

- trace derives solely from deterministic runtime facts
- state transitions are accurate
- learner can correlate trace item to highlighted block/code
- repeat iterations are understandable and not spammy
- condition result is visible in a child-appropriate form
- no PII or provider data enters trace
- tests prove ordering and before/after values.
- beginner trace avoids irrelevant engine detail
- Studio inspector can expose richer state
- both views correlate to the same canonical node
- trace rendering is localizable via #110.

## Constraints

- no LLM is required to produce objective trace facts
- do not expose internal stack traces or irrelevant engine state
- no PII or provider data enters trace

## Dependencies

- No explicit dependencies.
