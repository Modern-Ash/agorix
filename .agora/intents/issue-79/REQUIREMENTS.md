<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Deterministic Requirements

## Objective

Generalize the current single textual code generator into a provider-independent, deterministic **LanguageProjection** boundary.

## Requirements

- No separate requirements section; acceptance criteria remain authoritative.

## Acceptance criteria

- existing code-generator behavior can be represented by the new contract
- node-to-text mapping is language-independent at the API level
- unsupported canonical nodes fail explicitly
- formatting is deterministic
- projections can be registered/discovered without domain coupling to UI
- tests prove two independent projection implementations can satisfy the same contract.

## Constraints

- No explicit constraints.

## Dependencies

- No explicit dependencies.
