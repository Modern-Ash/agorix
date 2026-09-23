---
schema: "agora/requirements/v1"
id: "issue-16-text-projection"
title: "Text projection requirements (issue #16)"
status: "elaborated"
created-at: "2026-09-23T00:10:00.000000Z"
---

# Requirements

## Functional

- Deterministic formatting of educational code from canonical program state.
- Canonical node-to-text-range mapping for UI highlighting.
- Every POC operation supported with fixture coverage.
- No side effects; pure projection.
- Explicit unsupported-node error.
- Generated text is read-only in POC and never executed by the runtime.

## Acceptance

- Stable snapshots.
- Node-to-text mapping available for UI highlighting.
- Same program always gives same output.
- Generated code panel can refresh on every meaningful block edit.
- Projection latency suitable for interactive editing.

## Constraints

- Output lives in `packages/code-generator` (domain package, no UI deps).
- Format reference: `docs/architecture/PROGRAMMING_MODEL.md`.
