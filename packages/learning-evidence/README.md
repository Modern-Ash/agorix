# @agorix/learning-evidence

Minimal, privacy-preserving learning evidence and mission assessment model (issue #102).

Domain package: no React, Blockly, Phaser, Capacitor, VS Code API or provider SDK imports
(see `AGENTS.md` architecture invariants). No accounts, no identity, no network.

## Purpose

Record what shows the learner _understands_, separately from what shows the mission
_completed_. The two results are never merged into a single number.

## Evidence events

`agorix/learning-evidence-event/v1`. Nine event kinds, all payload-minimal:

| Kind                           | Learner action it records                                      |
| ------------------------------ | -------------------------------------------------------------- |
| `predictionMade`               | prediction plus whether it matched the runtime outcome         |
| `proposalDecided`              | accept/reject/modify, diff inspection, runtime test, challenge |
| `reflectionRecorded`           | that a local reflection was answered (never the text)          |
| `scaffoldDelivered`            | scaffold class, level 1-5, whether the learner answered        |
| `programRevisedAfterExecution` | revision kind, changed node count, after a failed run          |
| `debuggingSucceeded`           | attempts before success, whether runtime evidence drove it     |
| `codeViewUsed`                 | which code projection was inspected                            |
| `modelComparisonDecided`       | alternatives compared and whether the choice was justified     |
| `missionCompleted`             | the deterministic runtime outcome                              |

Every event carries `assistanceLevel`: `independent`, `hinted`, `proposed` or `delegated`.
The validation in `validateEvidenceEvent` fails closed on:

- unknown fields and unsupported schema versions;
- any field in `PROHIBITED_EVIDENCE_FIELDS` — identity, free text, timestamps, elapsed time,
  prompt counts, token usage and raw model confidence;
- reflection events that retain content or anything other than `localEphemeral` storage.

## Competency mapping

Every catalog competency from `docs/product/LEARNING_PROGRESSION.md` (#70) has at least one
evidence source, enforced by `assertCompetencyTraceCoverage`. `aiLiteracy.privateDataUnnecessary`
is proven by the schema invariant itself and is reported with `source: "schemaInvariant"`, so
it is never counted as learner understanding.

## Assessment

`assessMission` returns:

- `completion`: proven only by the deterministic runtime outcome, with
  `impliesUnderstanding: false` always set;
- `understanding.indicators`: one per competency with `demonstrated` / `partial` /
  `notObserved`, supporting event ids, the assistance level in effect, and a rationale;
- `peakAssistanceLevel` and `overAssistanceFlags`;
- `interpretation`: completion, understanding and assistance statements kept separate, plus
  cautions.

`understandingScore` weights each indicator by `ASSISTANCE_CREDIT`, which is non-increasing
in assistance rank and zero for `delegated`. An AI-solved mission scores strictly below a
learner-led one with the same completion, so no metric built here rewards over-assistance.

`SYNTHETIC_REPORTS` and `SYNTHETIC_SCORES` provide the synthetic mission assessment report
requested as issue evidence.
