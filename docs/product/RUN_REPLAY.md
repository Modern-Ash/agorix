# Run replay file (#1577)

The live runtime already records every outside input of a run (`LiveInputLog`) and `replayLiveRuntime` rebuilds the run from it. This adds the **file**: `encodeRunInputs` and `parseRunInputs` in `packages/runtime/src/inputLogFile.ts`.

- Kind `agorix/run-inputs/v1`. Holds the seed, the tick count and the inputs (events, keys, pointer, choices, loudness level, clock, answers), and optionally a program hash so a replay can check it is for the same program.
- **Typed answers are the learner's own words**, so they are left out unless the caller asks (`includeAnswers`). A replay without them waits at that question, as a live run does.
- **Strict reading.** A wrong kind, an extra field, a size past a cap (2,000,000 characters, 100,000 inputs, the live tick limit), an input past the last tick or out of order, a non-number or a non-integer tick is refused with a reason that names the field and never repeats its content.
- Nothing is sent anywhere; the file is made and read on the device.

Next increments of #1577: a Save/Open replay control in the studio, and a check that the program hash matches before replaying.
