<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Deterministic Unit of Work

- Work: issue-79
- Pathway: documentation

## Objective

Generalize the current single textual code generator into a provider-independent, deterministic **LanguageProjection** boundary.

## Scope

- Deliver the explicit source-issue objective within the governed Work.
- Preserve the source constraints and acceptance criteria without widening scope.

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
