# Logical Design - Issue #72

## Updated documents

- `AGENTS.md`: agent execution contract and mandatory AI-native invariants.
- `docs/architecture/SYSTEM_DESIGN.md`: target architecture, authority model, proposal path, runtime path and package boundaries.
- `docs/architecture/AI_TUTOR.md`: supersession note for legacy terminology.
- `docs/architecture/LEARNING_COMPANION.md`: provider-neutral companion contract and guardrails.

## Design decisions

- Keep existing `tutor-api` and `tutor-contract` names as legacy implementation boundaries for now.
- Introduce Learning Companion as the product architecture term.
- Separate ProgramProposal validation/preview/acceptance from deterministic runtime execution.
- Make runtime evidence the only proof of behavior.
- Require product behavior and repo verification to work without provider credentials.

## Traceability

- GitHub #72 acceptance: AGENTS prevents silent AI edits.
- GitHub #72 acceptance: architecture diagram separates AI proposal path from runtime execution.
- GitHub #72 acceptance: provider identity does not leak into domain packages.
- GitHub #72 acceptance: old tutor terminology is superseded or narrowed.
