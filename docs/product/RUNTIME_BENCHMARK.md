# Runtime work on scenes a child can build

`packages/runtime/src/bench.test.ts` runs five scenes of the size the Studio allows and counts what the runtime does. The **steps** are exact: the test fails if they change by accident. The **times** are from one development machine (Linux, Node 22, a warm run) and are indicative only: the test checks them against a generous budget (3 s a scene, 200 ms for the slowest live tick), never against these values, because a clock on a shared machine is not a fact.

| Scene                               | Steps | Time here (ms) |
| ----------------------------------- | ----- | -------------- |
| 12 characters, 10 blocks each       | 120   | about 9        |
| 10 × 10 × 5 nested repeats          | 511   | about 9        |
| a forever loop, until the budget    | 1000  | about 9        |
| 20 copies (the cap) and a loop      | 13    | about 1        |
| live: 12 characters, 10 s, 30 ticks | 1812  | about 35       |

## What it says about the limits (#1313)

On this machine the runtime is not what limits a scene. Twelve characters with a script each run in under 10 ms, and ten seconds of a live session of twelve characters take about 35 ms in all, a fraction of a millisecond a tick against about 33 ms available. So the caps (12 characters, the block counts, 20 copies) are not performance limits here; if they stay or change, the reason is what a child can follow, and #1313 asks for learner evidence on that. This benchmark gives no reason to raise or lower any of them. A phone is slower than this machine and was not measured.

Not done: running the live runtime in a worker (#1607). With these numbers the main thread is not under pressure, so it is not needed for speed; it would only matter for a much larger scene or a slow phone, which this benchmark does not show.
