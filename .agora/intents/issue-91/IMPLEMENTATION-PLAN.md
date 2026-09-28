<!-- agora-ai-sdlc:construction/v1 -->

# Implementation Plan — issue-91 (First Mission vertical slice)

Scope: minimal end-to-end vertical slice covering all 12 acceptance criteria
for one fixed mission, agreed with the human product owner as the first
iteration (remaining polish — Blockly-based composition, real LLM provider,
multi-mission curriculum, full hint ladder — is explicitly out of scope here
and tracked as follow-up, not silently dropped).

1. `@agorix/runtime` — deterministic interpreter + step observations + fact-only debugger text. (done, tested)
2. `@agorix/curriculum` — First Mission world + starting program. (done, tested)
3. `@agorix/tutor-contract` — deterministic fake proposal + explicit apply boundary. (done, tested)
4. `apps/web` — World/Code panels, run/step loop, AI proposal accept/reject, reflection, responsive layout without a permanent toolbox. (done)
5. Playwright — full journey + rejection/AC-006 + orientation-change specs, run across desktop + 5 tablet viewport projects. (done, 24/24 passing)

## Explicit product decision applied

`docs/product/LEARNER_JOURNEY.md` D4 (toolbox left rail) is superseded by
AC-010/AC-011 of this issue, per human confirmation in this Construction
session — recorded in `DOMAIN-MODEL.md` and reflected in the LEARNER_JOURNEY
document itself.

## Deferred (not built in this slice)

- Real Blockly block-editor composition surface (`packages/block-editor` remains a placeholder).
- Real (non-fake) LLM-backed tutor adapter behind `apps/tutor-api` (`packages/tutor-contract`'s fake generator satisfies the "no external LLM in CI" NFR for this slice).
- Multi-mission curriculum and the full hint ladder from PEDAGOGY.md.
- Persisted reflection/session state via `@agorix/persistence` (reflection is in-memory only in this slice).
