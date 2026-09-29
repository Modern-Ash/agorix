<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Deterministic Requirements

## Objective

Update the security/privacy model for an AI-native product that may run either entirely locally or through remote providers.

## Requirements

- no name, school, exact location or contact data required
- raw child free text not logged by default
- local-only mode makes network expectations explicit
- remote mode sends only capability-required context
- secrets never enter client bundle
- model/provider telemetry implications documented where knowable
- no silent analytics expansion.

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
