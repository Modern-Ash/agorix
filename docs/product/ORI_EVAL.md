# Ori's ideas, measured

Every idea Ori can put forward (the goals, sensor and list ideas) is run on five fixed scenes (empty, one move, move and say, a loop, a forever loop) with the same code the Studio uses: it must be a valid scene program once accepted, it must not stop the program from reaching its end, and the idea card must be able to say what it changes or stops. The ideas are built by deterministic code, so no provider and no credentials are involved and the numbers are the same on every machine.

- **Offered**: scenes where the idea can be put forward at all (a list idea needs a list, for example).
- **Invalid** and **Stops the program** must be 0; the test fails otherwise.
- **Changes nothing** and **Would stop something** are not defects: they are what the idea card tells the learner (#1584, #1585).

The test `kidsOriEval.test.ts` fails if this table is out of date and prints the new one to paste between the markers.

<!-- eval:start -->

| Idea       | Offered | Invalid | Stops the program | Changes nothing | Would stop something |
| ---------- | ------- | ------- | ----------------- | --------------- | -------------------- |
| ahead      | 5       | 0       | 0                 | 1               | 0                    |
| square     | 5       | 0       | 0                 | 1               | 0                    |
| backForth  | 5       | 0       | 0                 | 1               | 0                    |
| zigzag     | 5       | 0       | 0                 | 1               | 0                    |
| melody     | 5       | 0       | 0                 | 1               | 0                    |
| rhythm     | 5       | 0       | 0                 | 1               | 0                    |
| cheer      | 5       | 0       | 0                 | 1               | 0                    |
| jump       | 5       | 0       | 0                 | 1               | 0                    |
| spin       | 5       | 0       | 0                 | 1               | 0                    |
| grow       | 5       | 0       | 0                 | 1               | 0                    |
| bounce     | 5       | 0       | 0                 | 1               | 0                    |
| hideSeek   | 5       | 0       | 0                 | 1               | 0                    |
| wander     | 5       | 0       | 0                 | 1               | 0                    |
| follow     | 5       | 0       | 0                 | 1               | 0                    |
| greet      | 5       | 0       | 0                 | 1               | 0                    |
| rain       | 5       | 0       | 0                 | 1               | 0                    |
| crowd      | 5       | 0       | 0                 | 1               | 0                    |
| rainFalls  | 5       | 0       | 0                 | 1               | 0                    |
| crowdJumps | 5       | 0       | 0                 | 1               | 0                    |
| reactKey   | 5       | 0       | 0                 | 1               | 0                    |
| reactMouse | 5       | 0       | 0                 | 1               | 0                    |
| reactEdge  | 5       | 0       | 0                 | 1               | 0                    |
| **Total**  | **110** | **0**   | **0**             | **22**          | **0**                |

<!-- eval:end -->

## What the table shows

All 22 ideas are valid, none stops a program that was ending, and each is offered on every scene. The 22 "changes nothing" are one scene: with a `forever` loop first, an idea added after it never runs, so the card now says the idea changes nothing instead of promising something. A better answer for that scene (put the idea before the loop) is a future change; this table will show it as the column going to 0. List ideas (`listAsk`, `listFirst`, `listCount`) and the touch idea are not offered on these scenes because they need a list or another character; they are measured when a scene with one is added.
