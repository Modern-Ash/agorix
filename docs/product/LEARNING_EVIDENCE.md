# Learning evidence and assessment model

Traces to GitHub issue #102. Depends on #70 ([LEARNING_PROGRESSION.md](./LEARNING_PROGRESSION.md)) and
reads with [PEDAGOGY.md](./PEDAGOGY.md) and
[CHILD_SAFETY_PRIVACY.md](../safety/CHILD_SAFETY_PRIVACY.md).

Executable model: [`packages/learning-evidence`](../../packages/learning-evidence). This document is
the reviewable statement of the same rules; the package is the source of truth for validation.

## Purpose

Record what shows the learner **understands**, separately from what shows the mission
**completed**. The two are never merged into a single number, because an AI can finish a mission
in one step and a learner can finish it only after understanding why.

> AI proposes. Child decides. Runtime proves. Child explains.

Completion is proven by the deterministic runtime. Understanding is proven by observable learner
actions. The Learning Companion never supplies either proof.

## Evidence candidates and where they are recorded

| Candidate from #102                           | Event kind                     | Records                                                                               |
| --------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| prediction made                               | `predictionMade`               | the prediction and whether it matched the runtime outcome                             |
| proposal accepted/rejected/modified           | `proposalDecided`              | decision, diff inspection, runtime test, whether the learner challenged the companion |
| reason/reflection answer where stored locally | `reflectionRecorded`           | that a local reflection was answered; never the text                                  |
| hint/scaffolding level                        | `scaffoldDelivered`            | scaffold class, level 1-5, whether the learner answered                               |
| program revision after execution              | `programRevisedAfterExecution` | revision kind, changed node count, whether it followed a failed run                   |
| successful debugging                          | `debuggingSucceeded`           | attempts before success, whether runtime evidence drove the repair                    |
| code-language view used                       | `codeViewUsed`                 | which code projection was inspected                                                   |
| model-comparison decision                     | `modelComparisonDecided`       | alternatives compared, whether the choice was justified                               |
| mission completion                            | `missionCompleted`             | the deterministic runtime outcome                                                     |

Every event also carries `assistanceLevel`, so no evidence can be read without knowing how much
of the work the AI performed.

## Never measured

Per #102, none of these appear in the schema, and `validateEvidenceEvent` fails closed on them:

- number of prompts;
- amount of AI usage;
- speed or elapsed time;
- raw model confidence;
- free text, identity, age, school, location, device or network identifiers;
- timestamps (events are ordered by an in-attempt `sequence` only).

## Assessment model

`assessMission` returns two independent results.

**Completion** — `basis: "deterministicRuntime"`, taken from the last `missionCompleted` event, with
`impliesUnderstanding: false` always set. The type system makes "completed therefore understood"
unrepresentable.

**Understanding** — one indicator per competency from #70, each `demonstrated`, `partial` or
`notObserved`, carrying its supporting event ids, the assistance level in effect, and a rationale
that names that assistance level. Indicators carry a `source`:

- `learnerEvidence` — proven by a learner action;
- `schemaInvariant` — proven by the evidence schema's own guarantees. Only
  `aiLiteracy.privateDataUnnecessary` qualifies, because the schema accepts no field that would
  require private data. Schema invariants are reported separately and never counted as learner
  understanding.

Observable indicators for the dimensions #102 asks for:

| Requested indicator             | Competencies used                                                                                                                                                            |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| programming understanding       | `programming.sequence`, `programming.events`, `programming.repetition`, `programming.conditions`, `programming.state.variables`, `programming.decomposition.functions`       |
| debugging                       | `programming.debugging`, from revisions after a failed run and repairs driven by runtime evidence                                                                            |
| code reading                    | `programming.readingCode`, from inspecting a code projection                                                                                                                 |
| transfer across representations | `programming.modifyingTextualCode`, `collaboration.comparingAlternatives`, `aiLiteracy.modelsCanDisagree`                                                                    |
| AI skepticism/verification      | `aiLiteracy.aiCanBeWrong`, `aiLiteracy.fluentLanguageIsNotProof`, `aiLiteracy.runtimeEvidenceMatters`, `collaboration.challengingAiAnswer`                                   |
| learner agency                  | `collaboration.inspectingProposals`, `collaboration.decidingOnProposals`, `collaboration.testingProposals`, `collaboration.explainingDecision`, `aiLiteracy.learnerIsAuthor` |

`aiLiteracy.learnerIsAuthor` is only demonstrated when the learner recorded an actual
accept/reject/modify decision. A mission the AI finished alone never demonstrates it.

## Assistance level

`independent` → `hinted` → `proposed` → `delegated`, ordered from learner-led to AI-led.

Understanding credit is non-increasing across that order:

| Assistance level | Credit |
| ---------------- | ------ |
| `independent`    | 1      |
| `hinted`         | 0.75   |
| `proposed`       | 0.4    |
| `delegated`      | 0      |

`assertAssistanceCreditMonotonic` enforces the ordering, and the tests assert that re-tagging
identical evidence with a more AI-led level never raises `understandingScore`. The default metric
therefore cannot reward over-assistance: an AI-solved mission scores strictly below a learner-led
mission with the same completion.

Over-assistance is also reported directly, independent of any score:

- `aiSolvedBeforeLearnerActed` — a full solution was delivered;
- `proposalAcceptedWithoutInspection` — a proposal was accepted without opening the diff;
- `learnerActionMissingUnderHighScaffolding` — scaffolding escalated with no recorded learner action.

## Data fields and retention assumptions

Retention classes:

- `sessionMemory` — held in memory for the current attempt only, discarded when it ends;
- `localEphemeral` — written to local device storage scoped to one attempt, removed with it;
- `notStored` — never persisted; it is a schema guarantee or a marker.

| Field                   | Retention      | Purpose                                                            |
| ----------------------- | -------------- | ------------------------------------------------------------------ |
| `afterUnsuccessfulRun`  | sessionMemory  | Whether the edit followed a failed execution, i.e. debugging.      |
| `alternativesCompared`  | sessionMemory  | Breadth of the comparison the learner performed.                   |
| `answeredByLearner`     | sessionMemory  | Whether the learner responded rather than dismissing the scaffold. |
| `assistanceLevel`       | sessionMemory  | Discloses how much of the work the AI performed.                   |
| `attemptsBeforeSuccess` | sessionMemory  | Number of evidence-backed repair attempts.                         |
| `challengedCompanion`   | sessionMemory  | Whether the learner contradicted the companion.                    |
| `changedNodeCount`      | sessionMemory  | Size of the learner-authored edit.                                 |
| `contentRetained`       | notStored      | Always false; reflection text never enters the evidence record.    |
| `decision`              | sessionMemory  | Learner accept/reject/modify outcome for a proposal.               |
| `decisionJustified`     | sessionMemory  | Whether the learner recorded a reason for the choice.              |
| `id`                    | localEphemeral | Stable local handle for one evidence event; carries no identity.   |
| `inspectedDiff`         | sessionMemory  | Whether the learner opened the proposal diff before deciding.      |
| `kind`                  | sessionMemory  | Selects the event shape and its competency trace.                  |
| `level`                 | sessionMemory  | Scaffolding intensity on the 1-5 hint ladder.                      |
| `matchedRuntimeOutcome` | sessionMemory  | Whether the prediction matched deterministic runtime evidence.     |
| `prediction`            | sessionMemory  | What the learner expected before running.                          |
| `reflectionKind`        | sessionMemory  | Which prompt family the learner answered.                          |
| `revisionKind`          | sessionMemory  | Which part of the canonical program the learner changed.           |
| `runtimeOutcome`        | sessionMemory  | Deterministic runtime result that proves mission completion.       |
| `scaffoldKind`          | sessionMemory  | Class of scaffolding delivered.                                    |
| `schema`                | notStored      | Version marker for forward-compatible local parsing.               |
| `sequence`              | sessionMemory  | Ordering of events inside one mission attempt.                     |
| `storage`               | notStored      | Declares local-only storage for any reflection content.            |
| `testedWithRuntime`     | sessionMemory  | Whether the learner executed the proposal before trusting it.      |
| `usedRuntimeEvidence`   | sessionMemory  | Whether runtime observations drove the repair.                     |
| `view`                  | sessionMemory  | Which code projection the learner inspected.                       |

POC assumptions, consistent with `CHILD_SAFETY_PRIVACY.md`:

- everything is local and ephemeral; nothing is transmitted by this package;
- no account, display name, school or precise age is needed or accepted;
- reflection text, if the learner writes any, stays in local ephemeral storage and never enters
  the evidence record;
- aggregating or persisting evidence beyond one attempt requires separate approval and a
  jurisdiction-specific privacy review.

## Example mission assessment report (synthetic data)

Produced by `SYNTHETIC_REPORTS` in `packages/learning-evidence/src/synthetic-report.ts`. No real
learner, conversation or identifier is involved.

### Attempt A — learner-led

Nine events: one clarifying question answered, a local intent reflection, the Agorix Code view
opened, a prediction, an incomplete run, a learner revision, a second prediction, a
runtime-driven repair and a completed run.

```json
{
  "completion": {
    "completed": true,
    "basis": "deterministicRuntime",
    "runtimeOutcome": "completed",
    "impliesUnderstanding": false
  },
  "demonstrated": [
    "programming.sequence",
    "programming.debugging",
    "programming.readingCode",
    "collaboration.expressingIntent",
    "collaboration.answeringClarifyingQuestions",
    "collaboration.predictingBehavior",
    "aiLiteracy.runtimeEvidenceMatters"
  ],
  "schemaInvariantsProven": ["aiLiteracy.privateDataUnnecessary"],
  "peakAssistanceLevel": "hinted",
  "overAssistanceFlags": [],
  "understandingScore": 0.293
}
```

Interpretation: completion is proven by the runtime; 7 of 24 competencies are demonstrated by
learner action; peak assistance was a hint; no over-assistance flag was raised. Programming is the
only dimension with demonstrated competencies, so `understandingScore(report, "programming")` is
higher than the all-dimension score.

### Attempt B — same mission, AI solved it

Two events: a level-5 solution delivered and not answered, then a completed run.

```json
{
  "completion": {
    "completed": true,
    "basis": "deterministicRuntime",
    "runtimeOutcome": "completed",
    "impliesUnderstanding": false
  },
  "demonstrated": [],
  "schemaInvariantsProven": ["aiLiteracy.privateDataUnnecessary"],
  "peakAssistanceLevel": "delegated",
  "overAssistanceFlags": ["aiSolvedBeforeLearnerActed", "learnerActionMissingUnderHighScaffolding"],
  "understandingScore": 0
}
```

Interpretation, verbatim from the report:

```text
Runtime proved completion (completed).
No competency is demonstrated by the recorded evidence.
Peak assistance level: delegated.
Mission completed without any demonstrated understanding evidence; completion is not understanding.
Peak assistance was delegated to the AI; treat all indicators as assisted.
aiSolvedBeforeLearnerActed: Companion delivered a full solution; learner authorship evidence is missing.
learnerActionMissingUnderHighScaffolding: Scaffolding escalated while the learner took no recorded action.
```

Both attempts completed the mission. Only one of them produced understanding evidence, and the
default metric ranks it strictly higher. That is the property the model exists to guarantee.

## Explicit non-goals

- Grading, scores shown to the learner, or leaderboards.
- Age-based gating.
- Longitudinal learner profiles.
- Any measurement of prompt count, AI usage, speed or model confidence.
- AI judgment as evidence of understanding.
- Persistence of evidence across attempts without separate approval.
