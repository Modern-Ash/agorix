---
schema: "agora/domain-model/v1"
id: "issue-16-text-projection"
work: "text-projection/text-projection"
---

# Domain model: text projection

## Entities

- **ProjectionResult**: `{ code: string; mapping: NodeTextMapping }` — the sole
  output of `projectProgram`. `code` is the full educational source text;
  `mapping` is a `Record<nodeId, TextRange>` where every key is a canonical
  path-derived node id (see below) and every value is a half-open character
  range into `code`.
- **TextRange**: `{ start: number; end: number }` — `start` inclusive, `end`
  exclusive, both UTF-16 code-unit offsets into `ProjectionResult.code`.
- **NodeTextMapping**: `Record<string, TextRange>` — immutable after projection;
  UI highlighting looks up a block's canonical node id to obtain the region.
- **UnsupportedNodeError**: thrown for any `type` the v1 schema does not define
  (trigger/statement/expression), carrying `nodeId` (the path that failed) and
  `nodeType` (the unknown `type` value). Fails fast — never returns a partial
  projection.

## Operations covered (v1, `agorix/program/v1`)

| Canonical node | Projected form |
| --- | --- |
| `onStart` trigger | `whenStarted(() => { … });` |
| `move` | `sprite.move(steps);` |
| `turn` | `sprite.turn(degrees);` |
| `repeat` | `repeat(count, () => { … });` |
| `if` | `if (cond) { … }` |
| `touchingGoal` | `sprite.touchingGoal()` |
| `booleanLiteral` | `true` / `false` |
| `numericLiteral` | decimal number (deterministic `formatNumber`) |

## Node id scheme

Node ids are structural paths, stable for a given program shape (same
`ProjectProgram` structure ⇒ same ids), derived during a single projection
traversal:

- script: `scripts[i]` (and alias `scripts[i]/trigger` for the trigger node);
- statement: `scripts[i]/statements[j]`, nested `…/body[k]` or `…/then[k]`;
- expression: `…/condition` on the owning `if`.

Ids are unique within one projection; mapping keys always exist for every
emitted node (trigger, statements, nested bodies, conditions).

## Relationships

- `projectProgram(program: ProjectProgram): ProjectionResult` is pure: no I/O,
  no mutation of `program`, no globals; same input ⇒ byte-identical `code` and
  `mapping`.
- Projection does not execute code; generated text is display-only in the POC.
- UI consumes `mapping` for highlight; runtime never reads `code`.

## Invariants

- Every character range satisfies `0 ≤ start ≤ end ≤ code.length`.
- Mapping covers every projected node; no orphan ranges.
- Unknown node type ⇒ `UnsupportedNodeError`, never silent skip.
- Format is fixed (two-space indent, one statement per line, trailing newline)
  so snapshots are stable.
