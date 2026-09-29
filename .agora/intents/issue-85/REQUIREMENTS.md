<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Deterministic Requirements

## Objective

Replace the narrow tutor-only domain contract with a **LearningCompanion** capability model that supports pedagogical roles without binding the domain to a provider or to separate agents.

## Requirements

- No separate requirements section; acceptance criteria remain authoritative.

## Acceptance criteria

- existing hint behavior can migrate without provider coupling
- builder output cannot be confused with accepted canonical state
- debugger context distinguishes facts from model suggestions
- malformed responses fail closed
- contract supports local and remote providers equally
- no child PII required
- package has no provider SDK dependency.

## Constraints

- no child PII required
- package has no provider SDK dependency.

## Dependencies

- No explicit dependencies.
