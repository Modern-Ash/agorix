# Ori in VS Code: exploratory pedagogical review

Issue #1622. This is the review script and empty evidence record for a human
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
- Decision: pending human review

The reviewer must explicitly decide whether this exploratory session supports
the release gate. One session cannot establish comparative efficacy.
