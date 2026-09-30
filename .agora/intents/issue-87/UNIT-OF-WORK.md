<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Deterministic Unit of Work

- Work: issue-87
- Pathway: brownfield

## Objective

Create the domain protocol used whenever AI proposes a program change.

## Scope

- Deliver the explicit source-issue objective within the governed Work.
- Preserve the source constraints and acceptance criteria without widening scope.

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
