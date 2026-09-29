<!-- agora-ai-sdlc:construction/v1 -->

# Logical Design — issue-103

## Why a new CI-enforced rule, not only documentation

The issue's "Evidence" line explicitly asks for "testable controls mapped
to implementation issues," not only a written model. A doc alone can drift
silently from the code; `checkLearnerFreeTextLogging` makes the denylist's
highest-risk item (raw child free text reaching a log) fail CI the moment
it would happen, following the same static-analysis pattern as the
existing `checkClientSecrets`/`checkPiiDomainFields` rules in the same
file — consistent with the file's own stated design rule: "fail closed."

## Why the pattern only targets `learnerIntent`/`learnerQuestion`

These are the only free-text fields that exist in the contract today
(`LearningCompanionRequest.learnerIntent`, `TutorRequest.learnerQuestion`).
A broader "no console.log of any request object" rule would be unenforceable
without false positives (e.g. logging a sanitized diagnostics object is
fine and already allowlisted by policy). Scoping to the two named fields
keeps the rule precise and matches the documented denylist exactly.

## Why AC-004 (prompt injection) is a cross-reference, not new content

Re-deriving or restating #100's inbound validation boundary here would risk
the two documents drifting apart. `PRIVACY_THREAT_MODEL.md` states its
scope explicitly (outbound/data-minimization) and points to
`AI_OUTPUT_VALIDATION.md` as the single source of truth for the inbound
boundary, per this issue's "Read first" pointer to the transparent-UX/
output-validation lineage.
