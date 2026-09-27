# Level 1 Plan - Issue #72

## Goal

Align agent execution contracts and architecture invariants with the accepted AI-native product source of truth.

## Plan

1. Update `AGENTS.md`.
   - Replace optional tutor framing with transparent learning-companion invariants.
   - Make silent AI edits, provider-coupled domain contracts and hidden mutation explicitly forbidden.
   - Require independent review/evidence where issue #72 asks for it.

2. Update `docs/architecture/SYSTEM_DESIGN.md`.
   - Add architecture diagram separating proposal path from runtime execution.
   - Clarify proposal validation, learner acceptance, canonical mutation, runtime evidence, LanguageProjection, provider adapter and privacy boundaries.
   - Preserve domain/UI/provider independence.

3. Replace or supersede `docs/architecture/AI_TUTOR.md`.
   - Create a learning-companion architecture document.
   - Define pedagogical roles, proposal protocol, provider boundary, runtime grounding and offline/local-first behavior.
   - State how legacy tutor terminology should be interpreted.

4. Verify.
   - Run Markdown formatting/whitespace checks.
   - Search for mandatory invariants and boundary terms.
   - Perform architecture review with a different reviewer path or human review handoff.

## Out of scope

- Renaming source packages such as `tutor-api` or `tutor-contract`.
- Implementing LearningCompanion runtime code.
- Selecting a specific provider, local model or license.
