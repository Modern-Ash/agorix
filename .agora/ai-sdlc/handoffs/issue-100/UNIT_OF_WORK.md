# Issue 100 Unit Of Work

## In Scope

- Shared validation module or boundary used by provider-runtime/Learning Companion consumers.
- Adversarial fixtures for malformed schema, unsafe program proposal, over-assistance, PII-seeking content, hidden action, and provenance/context mismatch cases.
- Tests proving local/fake and remote adapter outputs pass through the same validator.
- Safe child-facing rejection message shape plus developer diagnostics shape.
- Documentation or checklist covering security-oriented validation behavior.

## Out Of Scope

- Legal/privacy review for real child accounts.
- Full production moderation service integration.
- Provider-specific safety SDK dependence.
- A new model-ranking or model-comparison activity.
- UI redesign beyond the minimum safe failure behavior needed for rejection.

## Dependencies

- #85 Learning Companion contract.
- #87 ProgramProposal protocol.
- #92 provider-neutral runtime contract.
- #90 scaffolding policy is referenced by the issue as the anti-over-assistance authority; if not implemented, construction must define a minimal local policy adapter without pretending #90 is complete.
- `docs/architecture/SYSTEM_DESIGN.md`, `docs/architecture/LEARNING_COMPANION.md`, and `docs/safety/CHILD_SAFETY_PRIVACY.md` are authoritative context.
