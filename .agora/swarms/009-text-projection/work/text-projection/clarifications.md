---
schema: "agora/clarifications/v1"
swarm: "text-projection"
work: "text-projection"
created-at: "2026-09-23T00:16:33Z"
last-run-input-sha256: "d095f76d8833645c94f11eeaec1b1f39dffa25d95a628358520baca6bf5fdd27"
last-run-question-count: 7
last-run-unanswered-count: 0
last-run-by: "project:ai-runtime-2"
last-run-at: "2026-09-23T00:16:33Z"
---

# Clarifications for text-projection

| Question | Answer | Actor | Timestamp | Input SHA-256 |
| --- | --- | --- | --- | --- |
| What exact set of program operations must projectProgram support in v1? | All POC operations in agorix/program/v1: trigger onStart (projected as whenStarted), statements move/turn/repeat/if, expressions touchingGoal/booleanLiteral/numericLiteral. Unknown node kinds raise UnsupportedNodeError with the nodeId/path. | project:ai-runtime-2 | 2026-09-23T00:16:33Z | d095f76d8833645c94f11eeaec1b1f39dffa25d95a628358520baca6bf5fdd27 |
| How should nodeId to text range mapping be represented? | ProjectionResult.mapping maps each nodeId to a {start, end} character range (end exclusive) over the generated output string, covering the exact source text emitted for that node. | project:ai-runtime-2 | 2026-09-23T00:16:33Z | d095f76d8833645c94f11eeaec1b1f39dffa25d95a628358520baca6bf5fdd27 |
| Is whitespace and newline formatting part of the deterministic contract? | Yes. The projection format is fixed (two-space indent, one statement per line, no trailing whitespace) so identical programs always produce identical output bytes. | project:ai-runtime-2 | 2026-09-23T00:16:33Z | d095f76d8833645c94f11eeaec1b1f39dffa25d95a628358520baca6bf5fdd27 |
| Does the projection run in the UI or as a pure domain function? | Pure domain function in packages/code-generator with no side effects, no UI dependency, and no I/O; consumers wire it into the editor. | project:ai-runtime-2 | 2026-09-23T00:16:33Z | d095f76d8833645c94f11eeaec1b1f39dffa25d95a628358520baca6bf5fdd27 |
| What error type is required for a node that cannot be projected? | UnsupportedNodeError, a custom Error subclass carrying the nodeId and node type. Projection fails fast and does not return a partial result. | project:ai-runtime-2 | 2026-09-23T00:16:33Z | d095f76d8833645c94f11eeaec1b1f39dffa25d95a628358520baca6bf5fdd27 |
| Which artifacts and evidence satisfy construction-verified? | domain-model, architecture, implementation-plan and test-strategy registered as construction artifacts, plus evidence test-suite from a deterministic vitest run covering every operation and the unsupported-node error path. | project:ai-runtime-2 | 2026-09-23T00:16:33Z | d095f76d8833645c94f11eeaec1b1f39dffa25d95a628358520baca6bf5fdd27 |
| Who approves inception and construction? | product-owner and developer for inception-approved; developer for construction-verified; product-owner for completion. | project:ai-runtime-2 | 2026-09-23T00:16:33Z | d095f76d8833645c94f11eeaec1b1f39dffa25d95a628358520baca6bf5fdd27 |
