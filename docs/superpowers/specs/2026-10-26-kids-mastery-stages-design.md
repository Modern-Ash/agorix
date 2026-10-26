# Kids mastery stages (design)

Issues #609 (EDU-03, six stages per concept) and #610 (EDU-04, progress from runtime evidence), epic
#582 (E4). Date: 2026-10-26. Status: **approved by the owner on 2026-10-26** with the decisions below.
This first slice is the model and the evidence only; no screen shows it yet. Adapting Kids and Ori to
the stage (#611), the band profile and onboarding (#607, #608) and new worlds (#612) come after.

## Owner decisions (2026-10-26)

1. **The six stages are a mastery ladder, the same for every concept:** Descubre, Imita, Prueba, Crea,
   Explica, Enseña.
2. **Only runtime evidence moves a child between stages.** An adult can see why, and a stage can go
   back down when the evidence says the child is struggling, but nobody can hand out stages.
3. **No birth date.** An adult picks one of three bands at first entry to the grown-ups area (later).
4. **First slice: model and evidence, no screens.**

## Concepts

Six programming competencies already in the catalog of `@agorix/learning-evidence`, each recognised
from the canonical program the child ran: `programming.sequence` (two or more blocks),
`programming.events` (a start other than the green flag, or a broadcast), `programming.repetition`
(repeat, repeat until), `programming.conditions` (if), `programming.state.variables` (a variable set or
changed), `programming.decomposition.functions` (a custom block called).

## Stages and the evidence that earns them

Evidence comes only from deterministic things that happened: a run that reached its end or did not, whether
it used help (an accepted Ori idea or an opened hint), whether it was a free creation, a prediction or
reflection that matched the run, and a custom block reused.

| Stage | Name     | Earned by                                                                        |
| ----- | -------- | -------------------------------------------------------------------------------- |
| 1     | Descubre | one completed run that uses the concept                                          |
| 2     | Imita    | one completed run with help, or one without (it implies having followed a model) |
| 3     | Prueba   | two completed runs without help                                                  |
| 4     | Crea     | one completed free creation without help                                         |
| 5     | Explica  | one prediction or reflection about it that matched the run                       |
| 6     | Enseña   | a custom block that uses it, called at least twice                               |

A higher rung implies the lower ones. **Going back:** three failed runs in a row that use the concept,
with no success in between, lower the stage by one; the next completed run restores it. Nothing else
lowers a stage, and nothing is ever removed from the counts.

## What is kept, and what is not

Per concept: eight small counters (capped at 99), the number of failures in a row, the stage, and the
last 20 changes, each with a **day** (no time), the stages it went from and to, and a reason code from a
fixed list. No program, no name, no text, no id of a project. Stored on this device only
(`agorix.kids.mastery.v1`), validated on every read, and never sent to Ori or any provider.

## Versioning

`MASTERY_VERSION` is stored with the state. A change to a rule bumps it, and a state of an older
version is read as empty rather than guessed at, so a rule change never silently rewrites history. The
rules are a pure function of the counters, so a test can prove every transition.

## Explaining

`explainMastery` returns plain sentences from the counters and the last changes ("3 runs without help",
"went back one stage after 3 failed runs"), in Spanish and English, for the grown-ups' summary later.
