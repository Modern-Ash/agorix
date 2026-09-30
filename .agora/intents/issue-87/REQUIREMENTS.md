<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Deterministic Requirements

## Objective

Create the domain protocol used whenever AI proposes a program change.

## Requirements

- A proposal must include:
- schema/version
- proposal id
- base program version/hash
- capability/source metadata
- pedagogical purpose
- affected canonical node ids where known
- structured operations/patch
- child-facing rationale
- optional concept tags
- no executable arbitrary code payload as authority.

## Acceptance criteria

- stale proposal cannot apply to changed base
- unknown operation rejected
- resulting program must validate
- deterministic diff generated independently from model prose
- proposal can be serialized/audited without PII
- no provider SDK types leak into protocol
- tests cover insert/change/remove/stale/invalid
- integrates with UI boundary from #75.

## Constraints

- no executable arbitrary code payload as authority.
- no provider SDK types leak into protocol

## Dependencies

- No explicit dependencies.
