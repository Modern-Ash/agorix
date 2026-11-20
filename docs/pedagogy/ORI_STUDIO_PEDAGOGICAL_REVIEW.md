# Ori in VS Code: exploratory pedagogical review

Issues #1622, #1653 and #1694. This is the review script and empty evidence record for a human
educator and a learner already comfortable with the Web editor. It is not a
claim that the review happened or that Ori improves learning outcomes.

## Preparation

- Use a synthetic `.agorix` project with a short sequence that does not reach
  its goal. Do not use a learner's existing project, name, account or free text.
- Install the candidate VSIX and connect it to a test tutor API. Confirm which
  Ori policy and model adapter are enabled without showing provider details to
  the learner.
- Prepare one run with Ori available and one with the endpoint unavailable.
  Keep project and mission semantics the same.
- Obtain the required adult/learner consent through the pilot process. Record
  no personal identifier in this file.

## Learner task

1. Open the Web-created project in Studio. Ask the learner to point to the code
   and the corresponding blocks.
2. Ask for a prediction, run the program, and find the runtime evidence for the
   missed goal.
3. Ask Ori to explain or help debug the selected node. Ask the learner which
   sentence is Ori's interpretation and which fact comes from the runtime.
4. Ask Ori for a bounded change. Ask the learner to inspect the diff, describe
   what would change, then choose reject, modify or accept. Do not direct the
   choice. Repeat with an alternative synthetic project if needed to observe
   more than one decision path.
5. Run again. Ask what the runtime proved and what remains uncertain. Ask the
   learner to explain one programming concept or change in their own words.
6. Disable Ori and repeat a basic edit/run task. Check that the learner can
   continue without the model.

## Observation rubric

Record direct observations, not inferred understanding. Use `yes`, `partial`,
`no` or `not observed`, plus a short non-identifying note for each:

| Criterion                                                                  | Rating  | Non-identifying observation |
| -------------------------------------------------------------------------- | ------- | --------------------------- |
| Finds code, block and runtime evidence for the same node                   | Pending |                             |
| Distinguishes Ori's suggestion from accepted program state                 | Pending |                             |
| Predicts before trusting a proposal                                        | Pending |                             |
| Can reject or modify without an accidental program change                  | Pending |                             |
| Compares the new run with the prediction                                   | Pending |                             |
| Explains one relevant concept or change                                    | Pending |                             |
| Continues the task with Ori unavailable                                    | Pending |                             |
| Uses review controls with keyboard or assistive technology when applicable | Pending |                             |

## Visual IDE usability and comprehension (#1694, #1653)

Run with the same installed VSIX, at **900 × 700** and at **1440 × 900**. Give
the learner the task only, no layout instructions. The observer stays silent and
records dead ends; a task that needs the observer's help is a failure.

| Task                                          | Pass when                                                  | 900×700 | 1440×900 | Non-identifying observation |
| --------------------------------------------- | ---------------------------------------------------------- | ------- | -------- | --------------------------- |
| Show where the stage is                       | Points at it without opening a panel                       | Pending | Pending  |                             |
| Find where to edit the program as blocks      | Finds Blocks unaided                                       | Pending | Pending  |                             |
| Find the text version of the program          | Finds Code unaided                                         | Pending | Pending  |                             |
| Run the program                               | Finds Run; no open panel covers it                         | Pending | Pending  |                             |
| Ask for help                                  | Finds Ori and recognizes it as the helper                  | Pending | Pending  |                             |
| Add a block inside a condition, mouse         | Insertion or drop target is visible                        | Pending | Pending  |                             |
| Add a block inside a condition, keyboard only | Completes without the mouse; focus is always visible       | Pending | Pending  |                             |
| Create an actor from a costume                | Finds the gallery; the actor appears on the stage          | Pending | Pending  |                             |
| Select an actor and read its runtime evidence | Can say which actor and which evidence they are looking at | Pending | Pending  |                             |

Comprehension check for the educator (`yes`, `partial`, `no`, `not observed`,
plus one non-identifying sentence each): the learner can say what each of
Scene, Blocks, Code, Run and Ori is for; can tell a costume from a backdrop from
an actor; and can tell what Ori only suggested from what the program contains.

## Failure paths

Run each once with the proposal pending. Every one must leave the accepted
program unchanged and the project runnable.

| Condition                          | Expected                                             | Observed |
| ---------------------------------- | ---------------------------------------------------- | -------- |
| Ori off (no endpoint configured)   | Deterministic help only; no error wall               | Pending  |
| No network                         | Plain offline message; the project still runs        | Pending  |
| Invalid or unsafe Ori response     | Rejected with a plain message; no partial write      | Pending  |
| Stale proposal (program edited)    | Refused as out of date, not applied                  | Pending  |
| Revision conflict on a remote save | Local accepted state kept; the conflict is explained | Pending  |

## Independent review (#1622)

A reviewer who did not author the change checks, and ticks only on evidence:

- [ ] Proposals are validated, bound to the current revision or hash, and refused when stale.
- [ ] No provider secret, child identity or free-text learner input reaches logs, fixtures or captures.
- [ ] LLM output never executes code or writes canonical state directly.
- [ ] Every control in the journeys above is keyboard reachable with a visible focus state.
- [ ] CI is green on the exact reviewed commit, including `studio-visual-vsix`.

## Stop conditions

Stop the session and record a blocking finding if an Ori suggestion enters the
accepted program without a visible decision, model text is presented as runtime
proof, an unsafe or unrelated response is shown, the program cannot run without
Ori, or a project/account identifier or learner personal detail appears in
provider-visible input or logs. Record the issue number and synthetic
reproduction, not child data.

## Evidence record

- Candidate commit/VSIX version: pending
- Test tutor API commit/configuration class: pending
- Date and reviewer role (no learner identity): pending
- Ratings and observations: pending
- Blocking findings and issue links: pending
- Screen captures at both window sizes (cropped; nothing identifying): pending
- Independent review checklist completed by role: pending
- Decision: pending human review

The reviewer must explicitly decide whether this exploratory session supports
the release gate. One session cannot establish comparative efficacy.

Do not close #1694, #1653, #1622 or the parents #1648 and #1618 until this
record is filled, every blocking or major finding is fixed or tracked in its own
issue, and the independent checklist is complete. Link this file in each closing
comment and update the status rows in
[STUDIO_RELEASE_GATE.md](../product/STUDIO_RELEASE_GATE.md). A pass supports
calling Studio visually ready; it does not establish learning effectiveness.
