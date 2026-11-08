# Ori reads the run: "what happened?" from runtime evidence

Plan, not yet built. Goal: when a program does not do what the learner expected, Ori points at **where and why**, using only what the deterministic runtime recorded. This is the part of Agorix that a Scratch clone with a chat box cannot do: the explanation is checkable against the run, not fluent guesswork.

Fits the product rules: _Runtime proves, the learner explains, AI proposes._ Findings come from the trace; wording is deterministic and offline; any fix is a visible proposal the learner accepts, rejects or changes.

## Where we are

- `kidsOriLoopDebug.ts` already diagnoses one family (a loop that does not end) from the trace and offers a reviewable fix (`KidsLoopHelp`).
- `kidsStudioCoach.ts` turns a run into plain facts (start, end, direction, where a move got stuck, how many times a condition said yes or no) and compares them with the learner's prediction.
- The live runtime (`createLiveRuntime`) now records, per executed statement: actor, script, node id, before/after world, condition result, notes, `seconds`, plus the list of script activations and an input log that replays the run exactly.
- Gap: each diagnosis is a one-off. There is no shared contract for a _finding_, no link from a finding to the block it is about or to the moment it happened, and no catalog beyond loops.

## What a finding is

A structured, serialisable fact set, never prose:

```
Finding { id, kind, actorId, nodeIds[], at?, counts{}, event?, confidence }
```

`kind` comes from a closed catalog. Wording is rendered from `kind` + facts by local copy (es/en, voseo audit applies). A provider may be asked to rephrase, but it only receives the structured finding (no names, no text, no values the learner typed), and the deterministic sentence is always available.

## First catalog (each detectable from the trace alone)

1. **Never started**: a script has no activation. Says which event never happened (key not pressed, message never sent, character never tapped).
2. **Message nobody hears**: a `broadcast` whose message no script receives.
3. **Condition never true / never false**: an `if` / `repeat until` / `wait until` whose condition gave the same answer every time it was asked, with the counts.
4. **Nothing visible changed**: the script ran, but the character stayed hidden, off the stage, at size 0, or the moves were clamped at the edge.
5. **Scripts working against each other**: two scripts of one character writing the same property in the same ticks with a net change of zero.
6. **Sound that cannot be heard**: a sound played while volume is 0.
7. **Prediction mismatch**: already in the coach; moves into the same contract.
8. The existing loop findings (forever, repeat until, wait until).

Rule for adding a kind: a fixture project where it fires, one where it must not, and a stated confidence. Budget: at most one finding surfaced per run (the highest confidence), so Ori stays quiet ("silence is respect").

## What the learner sees

- After a run that looks wrong (finding with high confidence), a quiet **"Ori vio algo"** marker; tapping it opens one sentence of evidence. Nothing speaks on its own, and the adult Ori switch hides it.
- **"Ver en el programa"** highlights the block (node ids already map to blocks and code lines).
- **"Ver cuándo pasó"** jumps to the frame on a timeline over the run (frames and the input log already exist; needs a time stamp per entry).
- If a simple fix exists, **a proposal with a visible diff** through the existing proposal path; accept, change or reject, one undoable transaction.
- The learner can still ask: "Ori, ¿por qué no se mueve?" picks the finding for that character.

## Architecture

- New pure package `packages/run-evidence`: `diagnoseRun(program, creative, run) -> Finding[]`. No UI, no provider SDK, no browser APIs (domain package rules). Reads `MultiActorRunResult` only.
- Web: copy, panel, block highlight, timeline. Reuses the code-strip highlight and the proposal review components.
- Runtime: add a virtual time stamp to trace entries (live already has it internally; batch gets a cumulative per-script value). Backwards compatible: optional field.
- Tutor API (later, optional): accepts a structured finding and returns a rephrased sentence under the existing validate-and-fallback contract. Not needed for the product to work.

## Increments (each a reviewable PR)

1. `run-evidence` with kinds 1–3 and 7, fixtures, no UI.
2. "Ori vio algo" marker and sentence in the Studio, "Ver en el programa", e2e, accessibility.
3. Time stamps and the timeline; "Ver cuándo pasó"; works for replayed runs.
4. Kinds 4–6.
5. Fix proposals for the findings that have an obvious, small fix; visible diff.
6. Optional rephrasing through the tutor API with structured input only.

## Validation

- A corpus: the Studio's own test projects plus Scratch imports (`.sb3` importer), each labelled with the finding expected or none. Track false positives, not just hits.
- Learner sessions (#389, #413) before changing any default: does the marker help a child fix something without an adult, and does it ever get in the way?

## Constraints (do not break)

- Findings are derived from runtime evidence only; a model never decides that something went wrong.
- No learner text, names or values leave the device; provider input is structural.
- No AI-originated change enters the program without the proposal path.
- A project and its findings work with no AI available and no credentials.
- Child safety and privacy override engagement: no counters of "failures", no streaks, nothing stored beyond the existing evidence log.

## Decisions (owner, 2026-11-08)

1. **The marker is shown by default** after a run that looks wrong (the adult Ori switch still hides it).
2. **Model rephrasing is in scope**, always behind the deterministic sentence and always fed the structured finding only (`toProviderFinding`).
3. **A finding kind may count in the evidence log**, counters only (kind and count, no text, no names, no values). Read as the first option offered: counting is allowed.
4. **Wording changes by age band**: the structured finding is the same; the sentence is rendered per band and language.

## Status

- Increment 1 (the `run-evidence` package, kinds 1–3 and 7, no UI): merged (#1275).
- Increment 5 (fix proposals), first fix only: a script that waits for a message nothing sends gets a proposal to send it from the first green-flag character, with the exact block shown and accept / decline (`kidsRunFixes.ts`). Other findings have no obvious small fix and offer none. In review.
- Increment 2 (the "Ori vio algo" marker, sentences by language and age band, "Ver en el programa"): in review. The loop findings still live in `kidsOriLoopDebug` and `KidsLoopHelp`; the marker stays quiet when they explain the run, and they move into the finding contract later. Evidence-log counters (decision 3) are not wired yet.
