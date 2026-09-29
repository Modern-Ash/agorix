<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Measurement Criteria — issue-103

- MC-001: `docs/safety/PRIVACY_THREAT_MODEL.md` contains both a local-mode and a remote-mode data-flow diagram.
- MC-002: every row in its per-data-class table cites a real file/type.
- MC-003: `node scripts/security-baseline.mjs` passes with the new `no-learner-free-text-logging` rule active; `scripts/security-baseline.test.mjs` has 6 new passing tests for it.
- MC-004: the doc's "Prompt injection / malformed provider output" section exists and correctly cross-references `AI_OUTPUT_VALIDATION.md`.
- MC-005: `CHILD_SAFETY_PRIVACY.md` and `WEB_SECURITY_BASELINE.md` both link the new doc; `checkSafetyDocs` passes.
- MC-006: the doc's "Deviations" section exists and is non-empty.
