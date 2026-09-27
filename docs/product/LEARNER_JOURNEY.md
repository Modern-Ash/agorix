# AI-native learner journey and editor information architecture

Traces to GitHub issues #8, #63 and #69. Source: PRODUCT_INTENT.md, MVP.md, PEDAGOGY.md, AGENTS.md, AI_TUTOR.md and issue #106 operational order.

## 1. Project / mission entry

- Learner creates or opens a local project.
- Learner selects "First Mission." For the POC, First Mission is the only functional mission; no mission catalog/list UI is required.
- No account creation, login or public-sharing step exists at any point.
- The mission introduces the goal as something the learner will build and explain, not something AI will complete.

## 2. Editor first load

Desktop/normal viewport:

- Stage/canvas, one starter sprite, block toolbox, workspace and generated-code panel are visible immediately.
- The generated-code panel is part of the normal editor, not an advanced mode.
- Mission context lives in a top/header area, visible without navigating away from the editor.
- Run / Stop / Reset controls are always reachable.
- Learning companion/help is contextual and non-blocking. It must never cover or replace the generated-code panel.

Narrow viewport:

- Panels stack vertically: blocks first, generated code immediately below.
- The generated-code band remains continuously visible, never behind a tab, toggle, advanced-mode switch or hidden "under the rug" surface.
- Code content may scroll internally for long programs; the code band itself remains visible.

## 3. Learner intent

The learner expresses intent in a child-appropriate way, such as:

- choosing the mission goal;
- arranging blocks;
- asking how to make something happen;
- responding to a prompt about what they want the sprite to do.

The system may ask clarifying or decomposing questions when that helps learning. Questions should reduce ambiguity and support agency, not turn the learner into a prompt engineer.

## 4. AI proposal boundary

The learning companion may propose a bounded next step, structure or explanation. Every AI-originated programming suggestion is a proposal until the learner decides.

A proposal must make clear:

- what would change;
- which blocks/code region it relates to;
- why the suggestion might help;
- that it may be wrong;
- how the learner can accept, modify or reject it.

No AI proposal may mutate the accepted canonical program invisibly.

## 5. Visual programming attempt

- Learner drags/composes blocks from the required POC set: `when run starts`; `move steps`, `turn`; `repeat N`, `if condition`; `touching goal?`.
- Every accepted block change updates the canonical program model.
- Blocks and generated code both derive from that one model and never own separate program state.
- If a proposal is accepted, the learner-visible result becomes part of the accepted program; rejected proposals leave the accepted program unchanged.

## 6. Continuous code observation

- The generated-code panel is visible at all times during normal editing.
- Every supported accepted block change updates the textual projection immediately.
- Selecting a block highlights its corresponding code region where implemented.
- The generated code is read-only in the POC and is never executed.
- The learner can compare proposal, accepted blocks/code and runtime result without losing the editor context.

## 7. Prediction before Run

When appropriate, the system asks the learner to predict behavior before execution:

- what happens first;
- how many times a repeated action runs;
- whether the sprite will reach the goal;
- what might go wrong.

Prediction is not a quiz grade. It prepares the learner to observe evidence.

## 8. Run / fail / iterate

- Run executes the accepted program deterministically against the fixed/update loop runtime.
- Stop halts execution.
- Reset stops execution and returns the stage/sprite to the mission's initial state; it does not delete or revert the learner's block program or generated-code projection.
- Editing blocks while a program is running stops the current run before the change takes effect; the learner re-runs to observe the new behavior.
- On a failed, incomplete or surprising attempt, the learner sees behavior-based feedback rather than an opaque correctness label.

## 9. Runtime evidence

Runtime evidence is the objective authority for behavior. It may include:

- sprite position or movement;
- whether the completion predicate was reached;
- observed loop counts or event order where available;
- deterministic validation messages;
- reset/run/stop state.

AI may explain or point to this evidence, but it must not claim unobserved program state or override the runtime.

## 10. Evidence-grounded debugging

The learner debugs by comparing:

- their intent;
- any AI proposal they accepted or rejected;
- the accepted blocks and code;
- their prediction;
- runtime evidence.

The learning companion may ask a diagnostic question, point to a relevant block/code region, propose a smaller change or explain a concept. It must keep the learner in control of the accepted program.

## 11. Improvement

The learner edits the accepted program and re-runs. The loop may repeat many times:

intent -> proposal or direct edit -> learner decision -> visible blocks/code -> prediction -> run -> observe -> debug -> improve.

Mistakes are expected learning material.

## 12. Mission completion

- Completion is evaluated deterministically by runtime/state, never by an LLM judgment.
- On completion, the learner sees confirmation tied to the mission's completion predicate, not a full-screen takeover that hides editor context.
- AI may help explain why the completion predicate was reached, but the runtime result is the proof.

## 13. Explanation / reflection / free play

After completion, the learner answers or skips one short reflection prompt. Good prompts ask the learner to explain a cause, compare attempts or predict a variation:

- "What made your sprite start moving?"
- "What changed between the version that stopped early and the version that reached the goal?"
- "What would happen if this loop ran twice as many times?"

Reflection is learning evidence but must not block basic POC completion. After reflection or skip, the learner may continue free play in the same project.

## 14. AI unavailable path

The core editor, runtime, mission and reflection flow must function if the learning companion is disabled or unavailable.

Fallback path: inspect the mission goal, compare blocks and code, predict, run, observe, edit and re-run. Mission completion remains deterministic and does not depend on AI.

## Happy path and stuck path mapping

Happy path: entry -> editor first load -> learner intent -> direct edit or bounded AI proposal -> learner accepts/modifies/rejects -> visible blocks/code -> prediction -> Run succeeds -> runtime completion -> explanation/reflection -> free play.

Stuck path: entry -> editor first load -> attempt -> prediction fails or runtime result is incomplete -> behavior-specific feedback -> compare intent/proposal/accepted program/evidence -> optional learning-companion scaffold -> learner changes accepted program -> re-run -> completion -> reflection/free play.

## Persistence and exit

- Autosave writes continuously to the versioned local project document; there is no manual save step the learner must remember.
- A version mismatch on load fails explicitly rather than silently corrupting the project.
- Exit requires a confirmation prompt only when persistence has actually failed or unsaved state can exist; routine exit after a successful autosave requires no confirmation.
- Reload of a fresh browser session retains the project and reproduces a consistent block/code state.

## Decision provenance

Issue #69 revises the earlier issue #8 journey around the AI-native north star from #63 and the operational order in #106. Earlier POC layout decisions remain useful implementation constraints, but the source-of-truth journey now treats AI as a transparent learning companion inside the normal loop, not only as optional stuck-path tutor help.

This document records product direction, not first-class Agora/Core approval evidence. The current #69 Inception and Construction records provide the governed approval trail.

## Explicitly out of scope for this journey

- Public sharing, accounts, badges, dashboards, remixing, classroom administration, payments, multiplayer, native mobile apps and hardware integration.
- React component implementation.
- Any mission other than "First Mission".
- Choosing a specific LLM provider.
- Hidden AI code generation or mission completion by AI judgment.
