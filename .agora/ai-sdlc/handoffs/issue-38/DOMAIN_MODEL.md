# Domain Model

## Entities

- Agorix Studio: VS Code extension surface for advanced learner progression.
- StudioProject: shared stored project plus textual projection.
- Projection Range: canonical node id to editor text range mapping.
- Execution Evidence: runtime result, World Preview frames and inspector rows from shared observations.
- ProgramProposal Review: pending proposal data with explicit reject/apply transitions.

## Boundaries

- Canonical program remains the accepted state authority.
- VS Code APIs are isolated to the extension entry/adapters.
- Runtime and stage semantics come from shared packages.
- ProgramProposal review cannot mutate accepted state without explicit apply.
