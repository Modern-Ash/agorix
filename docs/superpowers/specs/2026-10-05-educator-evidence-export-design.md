# Educator evidence export (design)

Sub-project 4 of the Studio "powerization" remainder (#251). Date: 2026-10-05.

## Goal

A user-initiated, local-only export of the **current session's** AI-literacy evidence for educators. Single session, no accumulation, no PII.

## Constraints

`docs/product/LEARNING_EVIDENCE.md`: aggregating or persisting evidence beyond one attempt needs separate approval and a jurisdiction privacy review. This export stays within one session, is written only after an explicit confirmation to a file the user chooses, and uses no network.

## Design

1. `AgentEvent` (agent-workflow) gains `proposalModified`, `alternativeChosen` and an optional `origin` (`provider` | `built-in`). `agentHost` records them. Ambient offers use the existing `ambientOfferStats` counters.
2. `packages/learning-evidence/src/educator-export.ts` (pure): `createEducatorEvidenceExport`, `validateEducatorEvidenceExport` (fail closed: unknown keys, non enum/number values, strings that look like paths or emails), `formatEducatorSummary`. Schema `agorix/educator-evidence/v1`, `scope: "single-session"`, `truncated` when the 200-event cap is hit. No scores; `completedByRuntime` is a runtime fact and the summary says completion is not understanding.
3. Command `agorixStudio.exportEducatorEvidence`: modal confirmation listing contents, save dialog, writes `.json` and a sibling `.md`. Cancel writes nothing.
4. Docs updated; Web/Studio progress-view consumption stays out of scope.
