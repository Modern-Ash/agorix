<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Deterministic Requirements

## Objective

Make execution causality inspectable without exposing raw developer logs.

## Requirements

- raw runtime trace remains separate from child-facing trace
- no LLM is required to produce objective trace facts
- optional AI explanation may consume the trace later
- do not expose internal stack traces or irrelevant engine state
- support collapsible/simplified presentation for beginners
- preserve accessibility.

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
