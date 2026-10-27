# Learning indicators for adults

Issue #632. Shown in the adult area (behind the grown-ups gate), on the device only.

## What is kept

Whole-number counters per local day, under `agorix.kids.indicators.v1`, for 14 days. Nothing else: no program, no text, no name, no project or character, no time of day, no device or account id. Nothing is sent to a server, to Ori or to any provider. An adult can clear it from the same panel; clearing browser data clears it too.

| Counter              | Counted when                                                        |
| -------------------- | ------------------------------------------------------------------- |
| `runs`               | a run of a mission or a free scene finishes                         |
| `completedRuns`      | that run met its goal                                               |
| `independentRuns`    | that run had no help from Ori and no opened hint                    |
| `hints`              | a ladder hint (not the solution) is opened                          |
| `solutionsShown`     | the last ladder step, the solution, is opened                       |
| `predictions`        | the child answers a prediction (not "not sure")                     |
| `predictionsMatched` | the answer matched what the runtime showed                          |
| `oriFallbacks`       | the server's idea did not arrive and Ori used local rules           |
| `chatFallbacks`      | the chat answered with its generic reply because the server did not |

## What is shown (last 7 days)

- **Independence** = `independentRuns / runs`, as a whole percent.
- **Reached the goal** = `completedRuns / runs`.
- **Hints per run** = `hints / runs`, one decimal.
- **Prediction hits** = `predictionsMatched / predictions`.
- **Ori offline** = `oriFallbacks + chatFallbacks`.

A ratio with nothing to divide shows "no data", never 0%. These are conversation starters for an adult, not a grade: a low independence on a new topic is normal.

## Limits

Counters cap at 9 999 and unknown or malformed stored values are discarded when read. The numbers describe one browser; a second device or a cleared browser starts again. They cannot say who did what on a shared device.

Related: the mastery stages (`agorix.kids.mastery.v1`, `docs/superpowers/specs/2026-10-26-kids-mastery-stages-design.md`) are a separate, per-concept record.
