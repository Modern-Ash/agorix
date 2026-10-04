# Agorix touch interaction model

## Purpose

This document defines how Agorix Web handles touch, drag, stylus-compatible input and the Action Palette. It extends the tablet-first shell from #118 and keeps the core invariant intact: the canonical program owns state; visual cards and generated code are projections.

## Interaction Principles

1. **Touch first, not touch only**: every critical action works with touch and keyboard.
2. **Drag is optional**: drag may become a convenience later, but the First Mission must be editable without drag.
3. **Context stays visible**: Action Palette and editing controls must not hide World, Code or the active card context.
4. **Commit is explicit where keyboards can intervene**: numeric editing provides visible apply/cancel controls so the learner can recover from virtual-keyboard focus.
5. **Stylus is additive**: stylus can later express path or intent, but it is not mandatory and does not generate code in this issue.

## Supported Interactions

| Interaction                 | Current behavior                                                   | Required fallback                                  |
| --------------------------- | ------------------------------------------------------------------ | -------------------------------------------------- |
| Tap                         | Add actions from Action Palette; select cards; run/step/stop/reset | Enter/Space on focused buttons                     |
| Drag                        | Not required for First Mission editing                             | Add/reorder/delete buttons                         |
| Reorder                     | Up/Down controls on each block card                                | Keyboard focus + Enter/Space                       |
| Long press                  | Reserved for future contextual help/inspect affordances            | No critical action depends on it                   |
| Bottom sheet/action palette | Contextual Action Palette below primary surfaces                   | Buttons remain keyboard reachable                  |
| Numeric input               | Number field with explicit Apply/Cancel controls                   | Keyboard typing + visible Apply/Cancel             |
| Orientation change          | React state and persistence preserve program                       | Playwright resize verification                     |
| Virtual keyboard            | Numeric controls remain near the focused field                     | Apply/Cancel remain visible in the card            |
| Stylus                      | Compatible with tap and numeric input                              | Future path/intent input only; no freehand-to-code |

## Action Palette

The Action Palette is the primary tablet insertion model. It groups actions by concept category and keeps insertion as a clear learner decision.

Current supported categories:

- Movement: Move, Turn.
- Control: Repeat, If touching goal.

Future-compatible categories:

- Data: Variable actions once the canonical program model supports variables.

## Visual Program Cards

Block cards are modern manipulable structures, not Scratch-like puzzle pieces. Each card must expose:

- block selection;
- numeric editing where relevant;
- Apply and Cancel for numeric edits;
- Move up/down reorder controls;
- Delete;
- non-color-only active state through focus/selection styling and code highlight.

## Scratch-familiar grammar, AI-native semantics

Agorix deliberately splits two layers (issue #203):

- **Interaction grammar is Scratch-familiar**: a categorized palette, drag-to-program with visible snap/insertion slots, inline value editing, stacked and nested blocks, Run/Stop, Step. A learner who knows Scratch should need no explanation. Every drag has a non-drag equivalent ([INPUT_PARITY_MATRIX.md](INPUT_PARITY_MATRIX.md)).
- **Semantics are AI-native and transparent**: generated code is always visible, the canonical program is the only authority, AI output is a proposal until the learner accepts, rejects or modifies it, and runtime evidence, not AI language, proves behavior. The project runs fully without AI.

Familiar gestures never bypass these semantics: no gesture applies an AI proposal implicitly. The release gate is [ADOPTION_USABILITY_CHECKLIST.md](ADOPTION_USABILITY_CHECKLIST.md) plus `apps/web/e2e/adoption-gate.spec.ts`, which asserts canonical hashes at authority boundaries.

## Acceptance Trace

- Touch-only First Mission editing: Action Palette buttons, numeric fields and run controls are touch targets.
- No-drag First Mission editing: add/reorder/delete controls require no drag.
- Reorder reliability: explicit Up/Down controls update canonical order and generated code.
- Palette context: palette remains a contextual surface under World/Code, not a permanent rail.
- Orientation: existing program state persists across viewport changes.
- Virtual keyboard: numeric edit Apply/Cancel remain in the same card as the focused field.
- EN/ES: labels are localized and tested.
- Automated coverage: Playwright covers the key paths.

## Ghost blocks, companion and prediction (Web)

- **Ghost blocks.** While a proposal is under review, blocks it would change or remove are outlined with a dashed, provisional style and described to screen readers; blocks it would add appear as dashed "Suggestion" rows after the program. Ghosts are not draggable, not focusable and never a drop target. Accept and Reject stay on the proposal card, so no gesture applies a proposal.
- **Agorix Agent companion.** The agent rests by default. It shows a short bubble only while an existing System-0 offer or a proposal review is active, announced once through a polite status region. A visible "Agent helps" toggle (stored in presentation preferences, never in the project) turns off offers, the intent dialogue and the AI suggestion activity. Editing, Run, Step and hints keep working.
- **Predict before Run.** When the agent is on and the program is not empty, a skippable chip asks "Will the character reach the goal?". Running without answering is a valid skip. After the run, the answer is compared with the runtime result (`touchingGoal`) in a neutral message; the comparison never scores the learner and never changes the program.
- **Drop slots.** Drop slots are numbered before the dragged block leaves its list; the move is indexed after removal. `finalMoveIndex` translates one into the other, so dropping a block on the slot next to itself is a no-op and matches Studio.
