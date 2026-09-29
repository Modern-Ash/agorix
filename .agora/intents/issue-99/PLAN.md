<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Level 1 Plan — issue-99

- implement-01: execute — AC-001 proposed vs applied
- implement-02: execute — AC-002 runtime evidence vs AI suggestion
- implement-03: execute — AC-003 "AI may be wrong" without excessive friction
- implement-04: execute — AC-004 status not color-only
- implement-05: execute — AC-005 screen-reader label parity
- implement-06: execute — AC-006 provider identity optional/developer-only
- implement-07: execute — AC-007 tablet proposal state jargon-free
- implement-08: deferred — AC-008 Studio progressive disclosure (see scope note below)
- implement-09: execute — AC-009 same distinction on both implemented surfaces
- verify: execute — run targeted verification and collect evidence before review.

## Scope note: AC-008 (Agorix Studio) deferred

This construction slice implements the `ProvenanceLabel` component and
wires it into `apps/web` only. Agorix Studio (`extensions/vscode`) is a
separate surface whose UI was not touched here; adding progressive
disclosure of provider/model diagnostics there is real, additional work
better scoped as its own follow-up rather than folded in — see
`LOGICAL-DESIGN.md`.

## Acceptance criteria trace

- AC-001/AC-002/AC-009: `ProvenanceLabel` `data-provenance` states (`suggestion`, `accepted`, `runtime-fact`) applied to the proposal card, post-accept message, and mission run-state message in `apps/web/src/App.tsx`.
- AC-003: badge copy ("AI suggestion — not applied yet") plus the pre-existing "Tutor suggestion — may not be right" panel heading.
- AC-004: every badge pairs a glyph + text, never color alone (verified by a unit test asserting non-empty visible text).
- AC-005: `aria-label` on each badge matches its visible text (verified by unit test).
- AC-006: no provider/vendor name appears in any badge (verified by unit test); the app already shows no provider identity anywhere.
- AC-007: badge copy avoids technical terms ("AI suggestion", not "LLM output" or a provider name); verified via the Playwright touch/tablet-safe transparency journey tests, unmodified and still passing.
