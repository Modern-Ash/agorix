<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Deterministic Unit of Work

- Work: issue-103
- Pathway: brownfield

## Objective

Update the security/privacy model for an AI-native product that may run either entirely locally or through remote providers.

## Scope

- Deliver the explicit source-issue objective within the governed Work.
- Preserve the source constraints and acceptance criteria without widening scope.

## Acceptance criteria

- data-flow diagram exists for local and remote modes
- every outbound field has justification
- logs have explicit allowlist/denylist guidance
- threat model covers prompt injection/malformed provider output at appropriate level
- child safety doc updated consistently
- deviations require explicit review.

## Constraints

- no name, school, exact location or contact data required
- no silent analytics expansion.

## Dependencies

- No explicit dependencies.
