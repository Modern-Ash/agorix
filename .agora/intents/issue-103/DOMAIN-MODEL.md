<!-- agora-ai-sdlc:construction/v1 -->

# Domain Model — issue-103 (privacy threat model)

## New

- `docs/safety/PRIVACY_THREAT_MODEL.md` — data-flow diagrams (local/remote), per-data-class decision table, logs allowlist/denylist, prompt-injection cross-reference, deviations.
- `scripts/security-baseline.mjs`: `LEARNER_FREE_TEXT_LOG_PATTERN`, `LEARNER_FREE_TEXT_LOG_SCOPE`, `checkLearnerFreeTextLogging` — new CI-enforced rule `no-learner-free-text-logging`.
- `scripts/security-baseline.test.mjs` — 6 new tests for the rule.

## Updated

- `docs/safety/WEB_SECURITY_BASELINE.md`, `docs/safety/CHILD_SAFETY_PRIVACY.md` — cross-link the new doc; the latter also gets an explicit local-mode network-expectation line.

## Grounded in, not speculating about

Every claim in the new doc was verified against actual source before
writing it: `apps/tutor-api/src/index.ts` (`toCompanionRequest`'s
`learnerIntent` stripping), `packages/persistence/src/store.ts`
(`ProjectMetadata`'s exact field set), and a repo-wide grep confirming zero
existing `console.*` calls in first-party source outside tests.
