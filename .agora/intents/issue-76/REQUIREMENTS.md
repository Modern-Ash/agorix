<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Deterministic Requirements

## Objective

Let the learner execute the program one meaningful instruction at a time and see the exact block and textual code responsible for the behavior.

## Requirements

- `Step` advances one pedagogically meaningful runtime event/instruction
- current canonical node id is explicit
- corresponding block is highlighted
- corresponding textual code range is highlighted
- stage update occurs after/beside the highlighted instruction according to documented timing
- repeated Step calls remain deterministic
- Stop/Reset semantics remain exact.

## Acceptance criteria

- same canonical program gives same Step sequence
- block and active language projection highlight same canonical node
- Step cannot race with Run
- editing while stepped/executing follows defined stop semantics
- Reset restores exact initial state and Step cursor
- loops/conditions have documented child-understandable stepping
- tests cover simple, repeat and conditional programs
- narrow layout remains usable.
- tablet touch Step is first-class
- Studio and Web produce the same canonical step sequence
- viewport/orientation changes do not lose step state
- presentation may differ but observations remain identical.

## Constraints

- No explicit constraints.

## Dependencies

- Existing canonical interpreter (#14), observations (#15), node↔text mapping (#16), editor (#20), and UX contract #74.
