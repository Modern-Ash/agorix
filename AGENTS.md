# Agent execution contract

Agorix is built under Agora AI-SDLC. GitHub issues are the executable work queue; the documents under `docs/` are the product and architecture source of truth.

## Mandatory workflow

1. Read the assigned issue and every referenced spec before changing code.
2. Do not expand scope silently. Open or request a clarification when a product/architecture decision is not covered.
3. Produce the artifacts requested by the issue before or together with implementation.
4. Keep changes small enough to review independently.
5. Add deterministic tests for success and failure paths.
6. Never put provider credentials, child personal data, secrets or production identifiers in source, fixtures or logs.
7. Open a PR linked to the issue. Do not self-merge.
8. Treat human review and CI evidence as gates, not ceremony.

## Product invariants

- The learner creates; the AI tutor assists.
- A project must execute without AI availability.
- Visual programming semantics and textual-code semantics must share one canonical program model.
- Child safety and privacy constraints override engagement/gamification goals.
- No social/public sharing in the proof of concept.
- The POC targets a complete learning loop, not feature breadth.

## Architecture invariants

- TypeScript first.
- Web client and execution engine are separable.
- Program model is serializable and versioned.
- Renderer/runtime must not depend on the AI tutor.
- AI provider integration is behind a server-side boundary.
- Domain packages must not import UI framework code.
