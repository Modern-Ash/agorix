<!-- agora-ai-sdlc:construction/v1 -->

# Test Strategy — issue-99

## Unit (Vitest)

`apps/web/src/ProvenanceLabel.test.tsx` (6 tests): distinct `data-provenance`
per kind; distinct non-empty visible text per kind (AC-004); aria-label
matches visible text (AC-005); Spanish localization keeps the same kind
(AC-007/AC-009); no provider/vendor name in any state (AC-006); "AI may be
wrong" communicated without alarming language (AC-003).

`apps/web/src/App.test.tsx` (+1 test): the tutor panel shows the
`unavailable` badge on initial load, before any suggestion/accepted badge
appears (AC-001/AC-002 baseline state).

Result: 381/381 passing repository-wide.

## E2E (Playwright, `apps/web/e2e/smoke.spec.ts`, +1 test)

"provenance is visually and textually distinguishable across suggestion,
accepted and runtime-fact states": walks the real UI from unavailable →
suggestion (preview proposal) → accepted (accept it) → runtime-fact (run
the program), asserting the `data-provenance` attribute and visible text at
each step, and that the suggestion badge disappears once accepted.

Runs alongside the full existing 24-test suite, all passing unmodified — no
regression in the touch/tablet transparency journeys the badges were added
to.

Result: 25/25 passing.

## AC-008 not tested

Deferred; see `PLAN.md`/`LOGICAL-DESIGN.md`.
