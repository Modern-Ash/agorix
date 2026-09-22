---
schema: "agora/domain-model/v1"
id: "issue-9-content-guide"
work: "delivery/first-work"
---

# Domain model: content guide copy categories

Not a code domain model — this deliverable is documentation. The "domain" is the set
of copy categories and how they relate.

## Entities

- **Copy category**: one of the 11 required categories from issue #9 (tone principles,
  toolbox labels, Run/Stop/Reset, code-panel explanation, mission intro, retry/error
  states, success state, tutor-unavailable state, hint levels, reflection prompt,
  wording-to-avoid).
- **Voice**: `system` (factual, plain-labeled) or `tutor` (tool-framed, non-human) —
  every copy category is attributed to exactly one voice, per PEDAGOGY.md "Feedback".
- **Runtime condition**: a deterministic MVP.md runtime state (e.g. version mismatch,
  empty program) that maps 1:1 to a retry/error message (R2).

## Relationships

- Every copy category → one or more requirement (R1-R6) it satisfies.
- Every retry/error message → exactly one runtime condition it explains.
- Hint-ladder entries (levels 0-5) are ordered and escalate only on explicit request
  or repeated failure (PEDAGOGY.md).
