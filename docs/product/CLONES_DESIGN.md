# Clones in Agorix: design for review

Not built. Clones ("create a clone of myself", "when I start as a clone", "delete this clone") are the largest block family of Scratch that Agorix lacks, and the one games need most: shooting, falling objects, a crowd that behaves alike. This says what they touch and offers three sizes, so the owner can choose before anything is written.

## Why they are not just one more block

Every block added so far was a statement or an expression on a fixed set of characters. A clone is a **character that appears while the program runs**. Four things in the code assume that does not happen:

- **The runtime fixes its actors at the start.** `createLiveRuntime` builds its actor list once from the project (`actorsForCreative`); the batch runner does the same. A clone has to be added to a running session, deterministically.
- **The stage draws the project's characters, not the run's.** The Studio renders `creative.actors`. A clone is not in the project, so something has to draw actors that exist only in the run.
- **The Studio allows one script per character** (`studio-actor-N-<character>`, at most 12), and a clone needs a second entry point (the "when I start as a clone" script) on the same character.
- **Other characters name each other by id** (`touchingActor`, `pointTowards`, `distanceToActor`, messages). A clone needs an id other scripts can reach, or a rule that they cannot.

Also touched: the four code views, the Blockly adapter, the Scratch importer, `run-evidence` (findings are per actor), the timeline (frames hold actor snapshots) and Ori's closed idea contract.

## What Scratch does, and what Agorix should keep

In Scratch a clone runs the original's scripts from the moment it exists (starting from the clone hat), shares the original's costumes and sounds, has its own position and its own copies of the sprite's variables, hears broadcasts, and is gone when the project stops or `delete this clone` runs. There is a hard cap (300 clones).

Agorix keeps what is cheap to make deterministic and safe for a child, and bounds the rest:

- A hard, small cap on live clones (proposal: **20**), checked by the runtime; `create clone` past the cap does nothing and leaves a note in the trace, like the list operations.
- Clone ids come from a counter in the run (`<actor>#1`, `#2`...), so the same inputs make the same run and a replay log still rebuilds it exactly.
- A clone starts at its parent's position, heading, size and costume, runs the clone script, and ends with `delete this clone` or when the session ends.
- No extra variables per clone at first (the free scene has three global variables only); a clone reads and writes the globals.

## Three sizes

**A. Full clones.** New model: statements `createClone` (of myself, or of another character) and `deleteThisClone`; trigger `onCloneStart`. Runtime: clones as dynamic actors in the live runtime (and the batch runner), each with its activations and an id from the counter; broadcasts reach them. Stage: draws run actors that are not in the project. Studio: a character may have a second script for the clone hat. Projections, adapter, importer, tests. This is Scratch's behaviour; it is the largest change in the product so far (model, runtime, stage, Studio rules, four projections).

**B. Copies without scripts (recommended first step).** One block, _Crear N copias_ (N from a closed list), that makes presentational copies of the character which follow a fixed rule chosen from a closed list (spread out, fall from the top, follow the leader with a delay), and disappear when the run ends. No clone hat, no second script, no per-clone code: the copies run no program of their own, so nothing in the Studio's one-script rule changes and no other script has to name them. It covers the common cases (a crowd, falling stars, a trail) and the stage only has to draw a bounded list of copies from the run. It does not cover shooting (a copy that runs its own code until it hits something).

**C. Do not add clones; use more characters.** The free scene already holds 12 characters, each with its own script, and messages start them. Cheapest and already true, but it cannot make "one more of these for every click", which is the point of a clone.

## Recommendation

Do **B** now and keep **A** as the destination. B gives children the visible result (many of something) with a closed, reviewable vocabulary and no change to the rules that keep a scene readable; it forces the two pieces A also needs (the runtime can add actors during a run, the stage can draw actors that are not in the project) without the harder one (a second script per character). If after B children keep reaching for shooting, A is then a known, smaller step.

## What it would take

For B: a statement and its closed rules in the model and validator; the live runtime and the batch runner adding bounded run-only actors; the stage drawing them (with a transition so they do not pop in); the four projections; the Blockly adapter; palette, tooltip, label and the coverage guards; Ori idea or two ("Lluvia de estrellas"); tests at each layer including a replay of a run with copies; the Scratch importer mapping _create clone_ to B where it fits, and reporting it where it does not.

For A, all of that plus: the clone hat and `deleteThisClone`; a second script per character in the Studio model and every place that reads `studio-actor-N-<character>`; cross-actor references to clones; findings and the timeline for actors that appear and disappear.

## Constraints that stay

The runtime remains deterministic and the trace remains the evidence; every program still runs without AI; nothing from a child leaves the device; Ori only proposes, and a clone-making program is reviewed like any other.

## Decisions for the owner

1. **Which size?** B first (recommended), A directly, or C (no clones).
2. **The cap:** 20 live clones or copies, or another number.
3. **If B:** is the closed list of rules (spread out, fall from the top, follow the leader) right, or is there a behaviour children ask for first?
4. **If A:** may a character have a second script (the clone hat), which changes the Studio's one-script-per-character rule?
