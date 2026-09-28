<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Deterministic Unit of Work

- Work: issue-85
- Pathway: brownfield

## Objective

Replace the narrow tutor-only domain contract with a **LearningCompanion** capability model that supports pedagogical roles without binding the domain to a provider or to separate agents.

## Scope

- Deliver the explicit source-issue objective within the governed Work.
- Preserve the source constraints and acceptance criteria without widening scope.

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
