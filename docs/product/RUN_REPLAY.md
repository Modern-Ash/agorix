# Run replay file (#1577)

The live runtime already records every outside input of a run (`LiveInputLog`) and `replayLiveRuntime` rebuilds the run from it. This adds the **file**: `encodeRunInputs` and `parseRunInputs` in `packages/runtime/src/inputLogFile.ts`.

- Kind `agorix/run-inputs/v1`. Holds the seed, the tick count and the inputs (events, keys, pointer, choices, loudness level, clock, answers), and optionally a program hash so a replay can check it is for the same program.
- **Typed answers are the learner's own words**, so they are left out unless the caller asks (`includeAnswers`). A replay without them waits at that question, as a live run does.
- **Strict reading.** A wrong kind, an extra field, a size past a cap (2,000,000 characters, 100,000 inputs, the live tick limit), an input past the last tick or out of order, a non-number or a non-integer tick is refused with a reason that names the field and never repeats its content.
- Nothing is sent anywhere; the file is made and read on the device.

## In the studio

Beside **Otra vez**, **Guardar repetición** saves the last run's inputs as `agorix-replay.json` on the device (answers left out), and **Abrir repetición** reads one. The file carries an identity of the program it came from; opening it on a different program, or a file that is not a replay, shows a short message and runs nothing. Opening a valid one watches the run again exactly as it was.

## What changed in a run (#1579, #1580)

`valueHistory` (kidsRunHistory.ts) reads the run's own trace and lists every number or word variable that took a new value, in order, each with the block that changed it; a loop or custom block is not blamed, the blocks inside it are. The Studio shows it under the timeline as "Qué cambió (N)": each line is a step, and pressing it goes to that step of the run. `lastChangeBefore` answers "which block gave this variable its value at this step". At most 60 changes are listed and the rest are counted. Breakpoints (pausing at a chosen block) are not built yet.

## Comparing two runs (#1581)

`firstDivergence` (kidsRunCompare.ts) reads two runs' traces and says where they stop agreeing: the first step with another block, with the character ending somewhere else, or with a value that came out different; or that one run is longer after agreeing on all of the shorter; or that they are the same. The Studio keeps the last finished run in memory only and shows "Comparar con la vez anterior" under the timeline, with one sentence and a button to go to that step of the current run. The same program giving the same run shows as "Igual que la vez anterior", which is what determinism looks like to a child.
