---
schema: "agora/unit-of-work/v1"
id: "issue-16-text-projection"
intent: "issue-16-text-projection"
title: "Implement text projection package"
status: "elaborated"
created-at: "2026-09-23T00:10:00.000000Z"
---

# Unit of work: text projection

## Scope

Implement `packages/code-generator`:

1. Pure function `projectProgram(program: ProjectProgram): ProjectionResult`.
2. Deterministic formatting rules for educational TS/JS-like output.
3. Canonical `nodeId -> { start, end }` text-range mapping.
4. Coverage of every POC operation with fixture tests.
5. Explicit `UnsupportedNodeError` for unknown node kinds.

## Out of scope

- Runtime execution of generated text.
- UI rendering (mapping is consumed by UI, not implemented here).
- Non-deterministic or pretty-printer-dependent formatting.

## Deliverables

- `packages/code-generator` source + tests.
- Snapshot fixtures for all operations and nested structures.
