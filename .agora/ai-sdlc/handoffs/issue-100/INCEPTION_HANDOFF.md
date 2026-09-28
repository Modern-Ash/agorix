# Issue 100 Inception Handoff

## Summary

Issue #100 should implement the safety valve between provider output and learner-facing or canonical-program surfaces. The product rule is simple: AI output is untrusted until it passes structured validation, safety policy, proposal policy, and provenance checks.

## Source Facts

- GitHub #100 requires validation layers for transport/parsing, schema/version, requested capability, scaffolding/assistance policy, ProgramProposal safety, content/safety policy, and context/provenance integrity.
- `docs/architecture/SYSTEM_DESIGN.md` separates AI proposal path from deterministic runtime execution.
- `docs/architecture/LEARNING_COMPANION.md` says ProgramProposal is data, not accepted program state, and provider output contains no executable hidden action.
- `docs/safety/CHILD_SAFETY_PRIVACY.md` prohibits child PII collection and requires minimum context and no provider secrets in browser.
- `ai-sdlc/project.yaml` configures cheap-first routing, no automatic frontier calls, and bounded paid-efficient/paid-standard budgets.

## Proposed Construction Direction

- Prefer a shared validator in the contract/provider boundary rather than adapter-specific validation.
- Use deterministic tests and adversarial fixtures first.
- Keep child-facing rejection plain and safe; keep diagnostics structured and non-PII.
- Do not implement provider-specific moderation SDK dependencies in this issue.

## Economics Constraint

- Construction should default to local deterministic work.
- Paid/model-assisted review is optional and must respect `paid-efficient: 4`, `paid-standard: 2`, and `frontier: 0`.
- Any usage numbers must be recorded only from authoritative telemetry.

## Human Gate

The inception gate remains blocked until Product Owner and developer approvals are explicitly recorded for revision 1. Construction must not start until the user authorizes the transition.
