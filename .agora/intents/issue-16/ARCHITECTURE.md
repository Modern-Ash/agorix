---
schema: "agora/architecture/v1"
id: "issue-16-text-projection"
work: "text-projection/text-projection"
---

# Architecture: code-generator text projection

## Placement

```
packages/code-generator/src/
  index.ts          Public entry — re-exports projectProgram, types, errors
  project.ts        Projection walker (pure), formatNumber, UnsupportedNodeError
  project.test.ts   Unit + snapshot tests for all ops, nesting, errors, ranges
  fixtures.ts       Shared projection fixtures (documented example + full coverage)
```

Dependency direction (SYSTEM_DESIGN.md):

```
program-model  ──▶  code-generator  ──▶  (UI, not here)
```

- `code-generator` imports only `@agorix/program-model` types (`ProjectProgram`,
  `Statement`, `Expression`, `Trigger`) — no `validateProgram` call inside the
  hot path (caller validates; projection trusts a typed `ProjectProgram` but
  still guards unknown `type` at runtime with `UnsupportedNodeError`).
- No React/Blockly/Phaser/provider imports (enforced by ESLint
  `no-restricted-imports` on domain packages).

## Data flow

```
ProjectProgram (canonical)
        │
        ▼ projectProgram()   [pure, sync]
ProjectionResult { code, mapping }
        │
        ├─▶ code panel (read-only render)
        └─▶ block ↔ text highlight (mapping lookup)
```

## Determinism contract

- Single left-to-right depth-first walk; `parts: string[]` joined once.
- Indent unit = 2 spaces; one statement per line; final `\n` on `code`.
- Numbers formatted via `formatNumber` (no locale, no exponent for integers in
  range, `-0` normalized to `0`).
- `mapping` ranges computed from cumulative string length during the walk —
  no re-scan, no floating offset drift.

## Error boundary

- `UnsupportedNodeError extends Error` with `name`, `nodeId`, `nodeType`.
- Thrown from the first unknown `type` in trigger/statement/expression switch
  (default branch), matching `program-model`'s fail-fast style.

## Out of scope (per UNIT-OF-WORK)

- Executing generated text (runtime never sees `code`).
- UI wiring of the panel (issue #20 / #17).
- Pretty-printer configuration or alternate dialects.
