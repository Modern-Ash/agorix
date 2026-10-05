# ADR 0008: Studio open product decisions

## Status

Accepted on 2026-10-05 by the product owner, after the independent Studio review
(`docs/evidence/STUDIO_INDEPENDENT_REVIEW.md`) left five items needing a product or privacy
decision. Builds on [ADR 0006](./0006-studio-agent-and-canvas.md) and
[ADR 0007](./0007-shared-core-and-two-experiences.md).

## Decisions

### 1. Assistance ceiling limits what the agent may show

`assistanceCeiling` follows the hint and proposal ladder in `docs/product/PEDAGOGY.md`. It caps what
the agent may offer or show, on every agent surface (Workbench loop, Companion, ambient offers):

| Ceiling | Allowed                                                                                                                         |
| ------- | ------------------------------------------------------------------------------------------------------------------------------- |
| 0       | Nothing: no offers, no proposals.                                                                                               |
| 1       | Diagnostic questions.                                                                                                           |
| 2       | And concept reminders.                                                                                                          |
| 3       | And pointing to the program area, code region or runtime observation.                                                           |
| 4       | And bounded proposals, AI or built-in. This is the default.                                                                     |
| 5       | A complete explanation, only after an explicit learner request following repeated failure. A proposal never reaches this level. |

Below 4 the "show me a suggestion" action is replaced by the help of the highest allowed level plus one
line saying the level is set to N and can be raised in the agreements. The learner owns the
agreements; educator control waits for a classroom mode. Events record the effective level.

### 2. Explain-after stays non-blocking

Reflection never gates completion (`PEDAGOGY.md`). Skipping is always allowed and counts as neutral
evidence: never a score, never nagging. No behaviour change. A later polish may collapse the prompt
to one line after repeated skips.

### 3. Provider text is plain text, labelled and never an exit

Provider `purpose` and `rationale` are AI-written free text shown to a child.

- The proposal card leads with what is deterministic: the operation list and the runtime evidence.
- The provider text follows, labelled "the AI's explanation (the runtime did not check it)".
- It is rendered as plain text, with control characters and spacing normalized.
- Text containing a link, a URL, markup or a code block is rejected by the shared safety boundary
  (`validateLearningCompanionSafety` and the intent-plan validator, local and remote alike). The learner
  sees the child-safe message and Studio falls back to the built-in proposal.
- It is not logged, not sent to telemetry, not written into events or the educator export.

### 4. Mission Spec is a learner-editable goal that anchors the agent

A short document stored in the project file as an optional field (schema bump with migration):
the goal (one sentence, up to 140 characters), a success check chosen from a fixed set the runtime can
verify (for example "touches the goal"), and an optional prediction prompt. The intent bar uses the
goal; plans anchor to the spec hash like they anchor to `baseProgramHash`; success is decided only by the
runtime, never by an AI. The goal text is learner text: excluded from the educator export, telemetry and
logs, and present only in the user's own project file. Educator-authored missions and sharing are out of
scope for v1.

### 5. `.agorix` custom editor

A `CustomTextEditorProvider` for `*.agorix` opens the Workbench canvas on the file with the code
projection beside it. Edits are `WorkspaceEdit`s, so undo and redo are VS Code's native ones. The
editor registers with priority `option` ("Open With...") first and moves to `default` in a later
release. Version 1 handles one project at a time, as the session state does today; remote projects are out
of scope.

## Consequences

- Decision 3 is implemented with this ADR; decisions 1, 4 and 5 are follow-up work in that order.
- Decision 1 changes behaviour for anyone who lowers the ceiling: they see less, deliberately.
- Decision 5 retires the snapshot undo stack in favour of the native one.
