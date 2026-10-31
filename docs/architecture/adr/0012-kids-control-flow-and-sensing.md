# ADR 0012: Kids control flow and sensing

## Status

**Proposed** on 2026-10-31 (issue #1132, from the capability audit #1119). It adds no code by itself; each construct below is its own PR once the product owner accepts or edits this ADR.

## Context

- A Scratch user expects `forever`, `wait until`, `stop`, mouse sensing and `ask and wait`. The Agorix model has `repeat`, `repeatUntil`, `if`, and these sensors: `touchingActor`, `touchingStageEdge`, `distanceToActor`, `keyDown`, `timer`, positions. The first group is absent from `program-model` (see `docs/product/SCRATCH_CAPABILITY_AUDIT.md`).
- The runtime is deterministic and has a step budget (`DEFAULT_EXECUTION_BUDGET = 1000`) with the outcomes `completed`, `budget-exceeded` and `stopped` already in place. Input reaches a run only as recorded events (`start`, `keyPressed`, `actorClicked`) and held keys.
- ADR 0011 forbids child free text, network and device access, and requires every capability to be a canonical statement or expression with runtime, three projections, block, Studio control and tests. Ori never receives child text.

## Decision

1. **`forever` is a bounded loop, not an infinite one.** It is a canonical statement with a body of at most three blocks, usable at most once per script and not inside another loop. The run ends when the step budget is reached with outcome `budget-exceeded`, and the Studio shows that as "Tu programa sigue y sigue: lo paramos" with the stage as it stood, never as an error. A scene stays interactive through events, so `forever` is mostly paired with `keyDown`, `touchingActor` and `if`.
2. **`wait until <condition>` is a statement with a timeout.** It accepts the same two-level conditions as `if` (#1131) and gives up after a fixed number of virtual seconds (10) with a trace note, so a condition that can never hold ends the run instead of hanging it.
3. **`stop` takes three closed choices:** this script, all scripts of this character, the whole scene. It maps to the existing `stopped` outcome and to a trace entry; it never closes the app or the project.
4. **Mouse sensing reads recorded input, not the live pointer.** `mouseX`, `mouseY` and `mouseDown` are expressions fed from pointer events the Studio records on the stage and passes to the run, like `keysDown` today. The run is therefore repeatable from its inputs. Pointer data stays on the device, is clamped to the stage, is never stored in the project or sent to Ori.
5. **`ask and wait` is replaced by a choice, not by typing.** `askChoice` shows a prompt chosen from a closed bundled list and up to four bundled answer options (text, picture or number); the picked option's index is stored in a variable. A child never types an answer, so ADR 0011 rule 8 holds, and nothing the child chooses is free text for Ori. Kids cannot type to the program; this is a deliberate difference from Scratch and is recorded here so it is not rediscovered as a gap.
6. **Not adopted:** clones (unbounded object growth, hard to bound for the step budget and the trace), `broadcast and wait` with return values, and any sensor reading camera, microphone, loudness, geolocation or device clock (ADR 0011 rule 3).
7. **Each construct ships as its own PR** with: model type and validator, deterministic runtime semantics and trace entry, Agorix Code, Python, TypeScript and Java projections, block and Studio control with keyboard and touch paths, an entry in `STUDIO_BLOCK_CATEGORY` and the coverage guard (`kidsCreationCoverage.ts`), unit tests, a fresh-session E2E, and a line in the Scratch matrix (#1122).
8. **Ori helps, never acts.** For `forever` and `wait until` Ori explains in plain words why a run was stopped and may propose a fix as a reviewable proposal with a visible diff (accept, change or reject). It reads block types and run facts, never choices or pointer positions.

## Order

1. `stop` (smallest; reuses `stopped`).
2. `wait until` (reuses #1131 conditions).
3. `forever` (needs the budget message and the placement rules).
4. Mouse sensing (needs event recording on the stage).
5. `askChoice` (needs bundled prompt and answer content and review).

## Consequences

- Kids get the Scratch control and sensing vocabulary that fits the safety model; the gaps that remain (typing an answer, clones, device sensors) are limits of the product, not backlog.
- The runtime stays deterministic and offline; every new input is an event the run receives.
- A program using `forever` always ends. The cost is that a very long animation is capped by the budget; raising it needs its own review.

## Alternatives considered

A true infinite loop driven by animation frames (not deterministic, cannot be traced or replayed, unbounded work on a child's tablet); live pointer reads inside the runtime (breaks repeatability and the evidence model); free-text `ask` with local-only storage (breaks ADR 0011 rule 8 and the Ori input contract); clones with a hard cap (still multiplies actors, scripts and trace size, so it needs a model change that is not justified by the learning value).
