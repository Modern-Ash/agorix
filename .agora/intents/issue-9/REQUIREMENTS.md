---
schema: "agora/requirements/v1"
id: "issue-9-content-guide"
intent: "issue-9"
work: "delivery/first-work"
source: "https://github.com/Modern-Ash/agorix/issues/9"
---

# Requirements: Issue #9 content guide

Derived from GitHub issue #9 acceptance criteria.

## R1 — Coverage

`docs/product/CONTENT_GUIDE.md` must cover every required category: tone/reading-level
principles; block/toolbox labels; Run/Stop/Reset; generated-code panel explanation;
mission intro; retry/error states; success state; tutor-unavailable state; hint levels
(0-5, per PEDAGOGY.md); reflection prompt; wording to avoid.

## R2 — Deterministic error mapping

Every deterministic runtime error surfaced by the POC (per MVP.md "Runtime") must map
to a specific child-facing message in the guide; no generic/opaque error copy.

## R3 — Tutor framing

Copy must never present the AI tutor as a human friend. Tutor-originated feedback must
be visually/verbally distinguishable from system feedback (per PEDAGOGY.md "Feedback"
and CHILD_SAFETY_PRIVACY.md "AI tutor").

## R4 — Code panel framing

The generated-code panel must be explained to the learner as "the code behind your
blocks," never as something magical or hidden.

## R5 — Tone constraints

Copy must be concise and encouraging without being patronizing; avoid "wrong/bad"
framing wherever a behavior-specific message is possible (per PEDAGOGY.md "Feedback").

## R6 — Privacy

No copy may prompt the learner for PII (name, age, school, location, photo), per
CHILD_SAFETY_PRIVACY.md "POC data minimization".

## Traceability

R1-R6 trace 1:1 to issue #9's acceptance checklist; evidence of satisfaction is the
published CONTENT_GUIDE.md plus product-owner review sign-off.
