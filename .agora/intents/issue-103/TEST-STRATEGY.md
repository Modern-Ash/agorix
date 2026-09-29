<!-- agora-ai-sdlc:construction/v1 -->

# Test Strategy — issue-103

## Unit (Vitest, `scripts/security-baseline.test.mjs`, +6 tests)

`no-learner-free-text-logging`: 3 parameterized cases catching a
console/logger call referencing `learnerIntent`/`learnerQuestion` across
different first-party locations; 1 case confirming the rule does not flag
reading/stripping/typing the field without logging it (matching
`apps/tutor-api`'s real `toCompanionRequest` code, verbatim); 1 case
confirming unrelated `console.error` calls are not flagged.

Result: 386/386 passing repository-wide.

## Why no new Playwright test

This issue's deliverable is a documentation model plus a static CI check,
neither of which has runtime browser behavior to exercise. The existing
`node scripts/security-baseline.mjs` run (part of `pnpm verify`) is the
executable evidence; it now scans 4 safety documents (was 3) and passes.
