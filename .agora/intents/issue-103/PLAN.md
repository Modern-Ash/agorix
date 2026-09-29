<!-- agora-ai-sdlc:deterministic-inception/v1 -->

# Level 1 Plan — issue-103

- implement-01: execute — AC-001 data-flow diagram for local and remote modes
- implement-02: execute — AC-002 every outbound field justified
- implement-03: execute — AC-003 logs allowlist/denylist
- implement-04: execute — AC-004 prompt injection/malformed output covered at appropriate level
- implement-05: execute — AC-005 child safety doc updated consistently
- implement-06: execute — AC-006 deviations require explicit review
- verify: execute — run targeted verification and collect evidence before review.

## Acceptance criteria trace

- AC-001: `docs/safety/PRIVACY_THREAT_MODEL.md` "Data-flow diagram" section (local + remote ASCII diagrams).
- AC-002: same doc's "Per-data-class decisions" table — every row cites the actual source file/type backing the claim.
- AC-003: same doc's "Logs allowlist / denylist" section, plus a new CI-enforced `security-baseline.mjs` rule (`no-learner-free-text-logging`, 6 new tests) making the denylist's first item machine-checked, not just documented.
- AC-004: same doc's "Prompt injection / malformed provider output" section, cross-referencing the existing #100 inbound validation boundary rather than duplicating it.
- AC-005: `docs/safety/CHILD_SAFETY_PRIVACY.md` and `docs/safety/WEB_SECURITY_BASELINE.md` updated to cross-link the new doc.
- AC-006: same doc's "Deviations" section (none, with justification).
