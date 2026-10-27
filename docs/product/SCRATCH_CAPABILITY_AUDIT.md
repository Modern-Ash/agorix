# Scratch capability audit for Agorix Kids

Audit date: 2026-10-24. Code baseline: `main` at `4457fb5`. Tracking issue: [#538](https://github.com/Modern-Ash/agorix/issues/538). This is a source and product-document audit, not a learner playtest. "Available" means reachable in a new Kids browser session without changing local storage. "Implemented" means code exists but the normal journey may hide or restrict it.

## Product target

Scratch is the reference for **creative capabilities**, not for Agorix's teaching sequence or visual identity. Agorix keeps a canonical, visible program; Ori may ask, explain, or offer a bounded change, but the learner reviews it and the deterministic runtime supplies the evidence. Ori's visual presence can be persistent while its interventions remain sparse (`docs/FOUNDATIONS.md`: "Silence is respect"). A general chat panel alone does not satisfy this target.

The Scratch Team's [editor tour](https://scratch.mit.edu/help/studio/tips/ui/tour-intro/) and [block/category inventory](https://scratch.mit.edu/help/studio/tips/home/) provide the comparison categories. Its [sprite and sound guide](https://scratch.mit.edu/help/studio/tips/howto/get-started-11/) confirms choosing, importing, recording, and switching appearances; the [backdrop guide](https://scratch.mit.edu/help/studio/tips/howto/favorite5/) confirms a browsable backdrop library. These help pages are an inventory, not a pixel or lesson-design specification.

## Capability matrix

| Capability                               | Agorix `main` evidence                                                           | New Kids session                                                                | Gap against the requested capability                                                                                                                                                                                                                            |
| ---------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Actors/sprites and independent scripts   | `AdvancedSceneScreen.tsx`, `kidsAdvancedEditorModel.ts`, `runtime/multiActor.ts` | After three completed missions and staged advanced tasks                        | Four fixed actors at most in that scene (Ori, friend, robot, frog); no broad, searchable bundled character library or arbitrary number of child-chosen actors.                                                                                                  |
| Bundled character and backdrop libraries | `kidsState.ts`, `CreateScreen.tsx`                                               | Six emoji explorers and four built-in worlds                                    | No categorized gallery, rich previews, or broad included art. Local `+ Explorador` / `+ Fondo` adds files but does not fill this gap. Bundled assets must remain immutable to the child.                                                                        |
| Costumes and backdrop changes            | `schema.ts`, `AdvancedSceneScreen.tsx`                                           | Three fixed costume IDs in an advanced scene                                    | No child-facing costume gallery/editor or general free-project costume/backdrop editing. The canonical model has `switchBackdrop`, but a general Kids authoring control is absent.                                                                              |
| Drawing/paint editor                     | No Kids paint screen                                                             | Absent                                                                          | No creation/editing of vector or bitmap costumes/backdrops. Needs a bounded child-safe editor and a canonical asset/persistence contract.                                                                                                                       |
| Sound library and own sounds             | `kidsSoundLibrary.ts`, `KidsAudioPanel.tsx`, `EditorScreen.tsx`                  | A tone; six synthesized choices behind `soundLibrary` flag                      | No rich browsable sound gallery. Local audio is adult-supplied behind `customAudio`; child recording/editing is absent. Respect the adult-media rule unless the owner changes it.                                                                               |
| Motion, looks, and stage positioning     | `schema.ts`, main and advanced Kids editors                                      | Core move/turn/repeat; advanced scene offers move 1 and costume                 | Model has more (`say`, `think`, show/hide, size, backdrop), but Kids lacks corresponding general visual authoring and stage controls. No full Scratch-style glide/point/bounce/layering.                                                                        |
| Events and control                       | `schema.ts`, advanced control screens                                            | Missions start on play; advanced adds fixed message flow, if/else, wait, random | No general event palette for arbitrary key/click/message names; no forever, wait-until, repeat-until, stop or clones.                                                                                                                                           |
| Sensing and operators                    | `schema.ts`, advanced score/control screens                                      | Limited goal/score expressions in staged tasks                                  | No general sensing palette (pointer, keys, touching another actor, timer, answer, etc.) or full child-composable operator palette. Arithmetic/comparison exist in the model or fixed advanced controls.                                                         |
| Variables and lists                      | `schema.ts`, advanced score/react screens                                        | Guided advanced stage                                                           | No general create/rename/delete and drag-to-compose data palette across free projects; watchers are stage-specific.                                                                                                                                             |
| Custom blocks and extensions             | No corresponding Kids authoring surface or model contract                        | Absent                                                                          | No child-defined procedures, extension palette, or hardware/extra capability plugins. These require explicit safety and deterministic-runtime design.                                                                                                           |
| Block editing                            | `EditorScreen.tsx`, `kidsFlags.ts`, existing Playwright coverage                 | Add/remove/reorder, undo/redo; several aids hidden                              | Duplicate, zoom, context menu, shortcuts and puzzle shape exist behind flags. Default `puzzleShape` is intentionally off under `DESIGN_SYSTEM.md`; functional insertion and accessible controls matter more than copying Scratch shapes.                        |
| Project persistence and exchange         | `ProjectsScreen.tsx`, persistence package                                        | Local save, reload, import/export `.agorix`, delete with adult confirmation     | No public Scratch project community. This is intentional under ADR 0009; adult-mediated file exchange is the approved path.                                                                                                                                     |
| Ori as an active companion               | `EditorScreen.tsx`, `KidsOriCard.tsx`, tutor service                             | Inline suggestions/chat in permitted contexts                                   | `oriFloat` is off by default; when on, the floating trigger requires `oriOffer?.proposal`, so Ori disappears while a proposal is pending/unavailable. The visible companion and proposal review need a unified interaction across creation and advanced stages. |
| AI-native learning loop                  | `docs/FOUNDATIONS.md`, proposal/review and runtime packages                      | Partial journey exists                                                          | Preserve learner intent, visible diff, accept/change/reject, run trace, prediction/reflection and offline fallback for every new creative tool. Do not add an asset or block path that lets Ori silently mutate accepted work.                                  |

## Release and design constraints

- A new browser enables only `customImages` (`kidsFlags.ts`, `KIDS_V2_ROLLOUT.md`); implementation status in `prototipo/v2/README.md` must not be read as default availability.
- `oriFloat` should mean a visible but quiet Ori. Open a proposal only when one exists; an idle tap may offer contextual help without fabricating an AI suggestion. Keep the adult Ori switch effective and avoid covering stage or controls on phone/tablet.
- The child may add an explorer or backdrop; only the adult controls that flag or replaces/removes bundled art (#531). Do not make bundled assets child-deletable.
- ADR 0009 excludes public profiles, discovery, comments, likes and remixing in Kids. Matching Scratch's **creative tools** does not authorize its public community features.
- The staged #524 rollout requires a new owner decision to change defaults before learner validation #389/#413. This audit does not claim those sessions happened.

## Recommended grouped iterations

1. **Visible companion and included galleries:** persistent quiet Ori in the editor; browsable bundled character/background/sound assets with categories and previews; selection and reload in a free project; regression tests with a fresh browser, touch and keyboard, and offline Ori. Keep child-added images and bundled assets distinct.
2. **General creative project:** child-selected multiple actors, their own scripts/costumes/sounds, backdrop switching and stage manipulation in one canonical free project. Cover save/import/export and Ori proposal review on those objects.
3. **General block vocabulary:** expose model-backed looks, events, control, operators and data through composable Kids blocks. Add missing deterministic model/runtime semantics only alongside visible controls and traces.
4. **Media creation and extension design:** paint/costume editor, recording/editing policy, custom blocks and safe extensions. Treat public sharing separately under ADR 0009.

Each iteration needs an issue with an observable child journey, success and failure tests, and a fresh-browser default check. A flag-on test alone is insufficient evidence that the capability is shipped to children.

## Progress on iteration 1

- #539 made Ori visible across Kids and enabled the implemented creative tools by default. The owner approved that rollout. Ori still proposes changes for the child to review; it does not edit a project silently.
- The included gallery adds 12 named characters, 9 backdrops and 12 short synthesized sounds. Characters and backdrops are grouped and searchable from Crear; sounds are previewed and chosen from a sound block in the editor. Gallery choices persist by allowlisted ID, separate from child-added files and adult image overrides. A fresh browser can use the included items without a flag or an LLM.
- The gallery expands the first creative choice. It does **not** provide Scratch's independent multi-sprite scripts, costume editing, broad block vocabulary, custom procedures or extensions. Those remain the next grouped iterations in #538.

## Progress on iteration 2 (merged in main)

- `Crear → Escena libre` lets a child add up to 12 gallery characters, select each character and author a separate canonical script. The stage runs all scripts through the deterministic multi-actor runtime and shows the execution count. The child can switch costumes and backdrops, play gallery sounds, inspect code projections, undo/redo, save, reopen and exchange the scene as `.agorix`.
- The included art stays immutable. A bounded import validates the program and rebuilds the creative metadata from known asset IDs. The new journey has unit coverage for separate scripts, persistence/import and failed index writes, plus a mobile browser journey with an accessibility check.
- This is the beginning of the general creative project, not Scratch feature parity. The current block palette is limited to movement, turning, costume/backdrop changes and gallery sound. Actor placement, paint/record tools, composable events/control/data, custom blocks and extensions remain open under #538. Ori's scene suggestion is a local bounded fallback with accept/change/reject; connecting the production LLM to this new free-scene contract also remains open. Do not present this fallback as a model response.

## Next studio vocabulary increment (merged in main)

- The free scene adds child-authored `say`, `think`, `show`, `hide`, size and bounded virtual wait blocks. Speech bubbles, visibility and size are rendered from runtime facts on the selected actor; another actor's state stays independent. The child can switch one character's start event from Jugar to touching that character on the stage, and the event is stored in the canonical script.
- Unit tests cover bounded statements, actor isolation and event activation. Browser tests cover the rendered result, reload and tapping the character after Jugar.
- This broadens the visual palette but does not yet provide general repeat/conditions, key/message event composition, variables/lists in free scenes, paint/recording, extensions or a model-backed Ori proposal contract. Those remain in #538.

## Ori for free scenes (merged and deployed)

- Escena libre requests an idea from the same-origin tutor server. The host's configured Codex/OpenCode CLI can generate one bounded move or turn for the selected actor. The shared contract validates the model's JSON, actor, script and operation on the host and again in the browser. The child sees a proposal and may accept, change or reject it; only acceptance or change updates the canonical program in one undoable transaction.
- The model receives actor count and selected block **types**, not child-authored speech text, image bytes, account details or the whole project. A failed, late or invalid model response produces a local reviewable idea without provider diagnostics in the child UI. The adult Ori switch hides scene suggestions.
- This makes the free-scene Ori button a real LLM entry point when the host CLI is available. It does not grant Ori open-ended editing, change Scratch-parity gaps above, or remove the offline path. The Web and tutor host were updated after #544 merged.

## General block vocabulary (third iteration, merged and deployed)

- Escena libre composes bounded key and message triggers, broadcasts, repeat and conditional blocks, and up to three named variables and lists. The data palette sets or changes numeric values, appends to a list and shows the selected actor's runtime values. A child can inspect the derived code and execution count, then save, reopen or exchange the same canonical program.
- The browser covers a fresh-session journey with data, repeat, condition, message and key events. Unit tests cover valid and rejected structures, actor isolation and portable import. Ori receives only structural block types and may still propose only a reviewable move or turn; learner data names and values do not enter its input.
- This increment deliberately bounds each repeat/condition body to one block, messages to three preset names and key events to five keys. General nesting, arbitrary operator composition, custom procedures, paint and extensions remain open in #538.

## Ori presence and motion (#547)

- Ori's existing floating guide now uses subtle motion tied to idle, open/listening and reflection states. The Kids editor distinguishes waiting for an offer, a proposal to review and an observed run. Escena libre and the advanced Ori actions distinguish waiting, reviewable proposal and a message without a proposal. These states come from app events, not a timer that pretends a model is working.
- Motion stops when the page is hidden and disappears under `prefers-reduced-motion`; text and controls still communicate the state. The mobile guide sits above the onboarding bottom action. Browser checks cover state changes and reduced motion, with visual inspection at 390 × 844 and 1440 × 900.

## Stage placement (next #538 increment)

- Escena libre lets the child select a character and place it on the stage with accessible directional controls. The position is part of project metadata and survives program edits, backdrop changes, reload, export and import. Runtime starts from that saved position.
- The selected character can also be dragged on the stage with a pointer. Bring forward/send backward controls change the stage order, which survives edits, reload and portable export/import. Directional buttons remain available for keyboard and switch access.
- Richer motion remains open. The matrix above records the original baseline; read these progress sections before treating a row as a current absence.

## Child-authored art (next #538 increment)

- Crear now offers a 256 px drawing canvas for a personal explorer or backdrop, with color and brush-size controls for touch and mouse. Saving runs the same local image validation and size bound as uploaded art, then adds a separate custom resource. Bundled gallery art stays immutable, and the adult's custom-image switch controls both upload and drawing.
- The drawing is available in local free projects. Escena libre now lets the child draw and reselect personal costumes for each actor and backgrounds for the stage. These are stored as bounded project assets and are never sent to Ori or a provider.
- The v1 portable format limits asset `source` to a short reference and does not embed drawing bytes. Reusing a local custom ID in Escena libre would lose the image on another device.
- The portable media contract supports a v2 envelope with validated embedded PNG/WebP images. Projects with drawn media show an adult gate and a separate confirmation before export includes their images; a normal export does not include them. Imported scenes render the saved art without depending on the original browser. A child can reopen and edit their own Studio costumes and backdrops, or add a local image as either kind; the browser normalizes and bounds the file before it reaches the project. Bundled art remains immutable. Full Scratch media tooling remains open.

## Composable controls and motion (next #538 increment)

- Escena libre can group the last one to three authored blocks into a repeat or conditional block. Grouping is one undoable canonical transaction; imported projects use the same bounded validation. Control depth is capped at two and a script at 60 statement nodes, while the runtime keeps its deterministic 1,000-step ceiling.
- A variable can be set from another variable plus, minus, times or divided by a bounded literal; division by zero is rejected. The child can choose greater-than, less-than or equal comparison, optionally against that calculation, and see the resulting expression in the visual stack and generated code.
- Movement now includes backward steps and 45°, 90° and 180° turns in either direction. The runtime trace, stage, save/reopen and portable import remain the evidence. Glide, pointing, sensing, general expression nesting, custom procedures and extensions remain open.

## Bounded list editing (grouped with Kids selection fix)

- Escena libre now lets a child remove a list item at a chosen one-based position, store an item's value in a variable, and store a list's length in a variable. Positions are limited to 1–10 in the visual palette and validator. The canonical program drives the runtime, code projection, save and reopen path; an empty list stays visibly empty in the watcher.
- This is a bounded data vocabulary increment under #538. General list indexing by expressions, arbitrary nesting and Scratch's full data palette remain open.

## Insert, replace and integer chance (#538)

- Escena libre now exposes one-based insert and replace at positions 1–10, plus a bounded whole-number random expression for a variable. Insertion before item 1 works on an empty list; position `length + 1` appends. Invalid positions and a full 100-item list leave state unchanged with a runtime note. A seeded run reproduces the same random result.
- The canonical validator, deterministic runtime, block adapter and Agorix Code, Python and TypeScript projections recognize the two new list operations. Tests cover valid and invalid indexes, full lists, code projection, visual authoring and reopen. More general list expressions, sensing, custom procedures and extensions remain open.

## Sound volume and variable watchers (next #538 increment)

- Escena libre exposes bounded Set volume and Change volume blocks. They update the canonical program, the deterministic runtime and the generated code. A gallery sound played from the run trace uses the volume recorded at that sound block; the stage shows the final volume after Jugar.
- A child can add Show variable and Hide variable blocks for a declared variable. The selected actor's watcher follows the runtime visibility state. These blocks survive project reopen and remain subject to the studio's actor and block limits.
- This increment uses operations already supported by the shared model and runtime. Stop sounds, sensing, movement to coordinates, custom procedures and extensions still need separate visible controls and runtime evidence before claiming parity.

## Stage coordinates and sound stop (next #538 increment)

- Escena libre adds a bounded **Ir a posición** block (horizontal 0–320, vertical −100–120). It is a canonical `goTo` statement with validator, visual adapter, deterministic runtime trace and Agorix Code, Python and TypeScript projections. The actor's heading is preserved; invalid or non-finite coordinates are rejected before mutation. The project reopens with the same block and behavior.
- **Detener sonidos** is now visible in the same palette. The runtime clears active sounds at that statement, and Web Audio contexts started by the scene are closed when the block executes. A fresh Play run stops any sound left from the previous run. The browser remains functional if audio is unavailable.
- These blocks do not constitute general sensing or Scratch parity. Sensors need an explicit multi-actor contact, edge and input contract, including coordinate conventions and observable results, before an authoring surface is added. Custom procedures and extensions also remain open under #538.

## Position and actor-contact sensors (next #538 increment)

- Escena libre can store the running character's X or Y position in a variable. A child can choose another character and add or group an `if touching character` block. The canonical model validates the expression, the deterministic runtime checks center distance and visibility, and the visual and code projections derive from the same program. The last `if` result is shown as yes/no after Jugar, alongside the scene movement and variable watcher.
- Contact is intentionally bounded: centers within 24 stage units, visible characters only, with other characters sampled at the start of the current script activation. It does not inspect image pixels or send art to Ori. Missing, hidden or distant targets return false. Save/reopen and offline play retain the same result.
- Stage-edge, color, pointer, keyboard-state and microphone sensing, custom procedures and extensions remain open under #538. Their input and privacy contracts need separate design and tests.

## Stage edge and distance sensors (next #538 increment)

- Escena libre adds “Si toca el borde” and “Guardar distancia” to a selected character. Edge sensing carries the 0…320 by −100…120 rectangle in the canonical condition; contact means the sprite center is within 12 units of any side or beyond it. Distance measures centers to the selected other character, including hidden characters, and returns −1 only if a target is missing. The other character's position is sampled at script activation, so execution and export/import stay deterministic.
- The visual adapter, code projections, runtime, saved program and yes/no conditional evidence derive from the same expressions. Browser tests cover mobile accessibility and reopening; unit tests cover true/false edges, invalid rectangles, visible/hidden and absent distance targets.
- Color, pointer, keyboard-state and microphone sensing, custom procedures and extensions remain open under #538. They need their own input and privacy contracts before authoring controls are added.

## Pointing and edge bounce (next #538 increment)

- Escena libre exposes Point in direction (right, down, left, up), Point at another character, and If on edge, bounce. The canonical validator, deterministic runtime, block adapter and Agorix Code, Python and TypeScript projections recognize all three; the run trace names each one.
- Heading 0 faces right and 90 faces down, matching the stage's y axis. Point at uses the other character's position when the script starts, so a run is reproducible. A target missing from the stage leaves the heading unchanged and records a runtime note. Bounce keeps the character inside the scene limits (x 0–320, y −100–120) and reflects the heading; away from an edge it changes nothing.
- Free-scene authoring accepts only those four directions and a character that exists in the scene. Tests cover validation, runtime, a whole-scene run, projections and reopen. Movement to coordinates, gliding, rotation style and sensing remain open.

## Repeat until (next #538 increment)

- Escena libre can group the last one to three blocks into **Repetir hasta tocar el borde** or **Repetir hasta tocar al personaje**. The canonical `repeatUntil` statement carries its condition; the validator, deterministic runtime, block adapter, trace and Agorix Code, Python and TypeScript projections derive from the same program.
- The condition is checked before every pass, so a character that already satisfies it does not run the body. A loop whose condition never becomes true stops after 100 passes with a runtime note, so a run always ends. Broadcasts sent from inside the loop reach the other characters.
- Only the two sensor conditions already available in the scene are offered. Waiting until a condition holds, forever loops, stop-all and general variable comparisons as loop conditions remain open.

## Change size (next #538 increment)

- Escena libre adds **Cambiar tamaño** with −50, −25, +25 and +50 percent. The canonical `changeSize` statement accepts any whole step from −100 to 100; the runtime adds it to the character's current size and keeps the result between 1 and 400 percent. Only the selected character changes.
- The validator, deterministic runtime, block adapter, trace and Agorix Code, Python and TypeScript projections derive from the same program. Unit and mobile browser tests cover validation, clamping, a two-character scene, accessibility and reopening.
- Next-costume, graphic effects, layer order and sizes from variables remain open.

## Remainder operator (next #538 increment)

- Escena libre adds **resto** (mod) to the calculation menu used to set a variable or compare. The canonical `modulo` expression takes the sign of the right operand, so −7 mod 3 is 2, like Scratch. A zero divisor halts the run with a deterministic `modulo-by-zero` error; the scene accepts only a non-zero whole number as the divisor, the same rule as division.
- The validator, runtime, block adapter and Agorix Code, Python and TypeScript projections derive from the same program. Unit and mobile browser tests cover signs, zero, a scene run, accessibility and reopening.
- Rounding, absolute value, text joining and other operators remain open.

## Rounding and absolute value (next #538 increment)

- Escena libre adds **Fijar con función** with absolute value, round, round down and round up, applied to a variable. The canonical `mathFunction` expression rounds half up like Scratch (3.5 becomes 4, −2.5 becomes −2) and never yields negative zero. Division can now be followed by a round to get a whole result.
- The validator, runtime, block adapter and Agorix Code, Python and TypeScript projections derive from the same program; unknown functions are rejected before a run. Unit and mobile browser tests cover each function, a divide-then-round scene, accessibility and reopening.
- Square root, trigonometry, text joining and string operators remain open.

## Layer order (next #538 increment)

- Escena libre adds **Pasar al frente** and **Pasar al fondo**. The canonical `goToLayer` statement moves the running character to the front or back of the stage order for that run, and the stage and each replay frame draw characters in that order. The saved scene order set with the layer buttons is not changed by a run, and the order in which characters run does not change either.
- The validator, runtime, block adapter and Agorix Code, Python and TypeScript projections derive from the same program. For a single sprite the block is a harmless step. Unit and mobile browser tests cover front, back, run order, the unchanged saved order, accessibility and reopening.
- Layering relative to one chosen character, graphic effects and next costume remain open.

## Glide to position (next #538 increment)

- Escena libre adds **Deslizar a posición**, reusing the horizontal and vertical fields of Go to position and the 0.5, 1, 2 or 3 second choice of Wait. The canonical `glideTo` statement ends at the target without changing the heading and spends those virtual seconds, sharing the 60-second virtual budget with `wait`; going over it ends the run as budget-exceeded.
- The run trace records one step with the position before and after; there are no in-between positions, so replay shows the character jumping to the target rather than sliding. The validator, runtime, block adapter and Agorix Code, Python and TypeScript projections derive from the same program. Unit and mobile browser tests cover bounds, virtual time, the shared budget, accessibility and reopening.
- Animated in-between frames, gliding to another character or a random position, and rotation style remain open.

## Custom blocks, model and runtime (first slice of #538 iteration 4)

- Design: `docs/superpowers/specs/2026-10-25-kids-custom-blocks-design.md`. The canonical `Script.procedures` list holds a character's own blocks (up to 20, body up to 20 statements, name of 1–20 letters, digits, spaces, `_` or `-`), and `callProcedure` runs one of them. Ids are unique across the program, so each character's blocks need distinct ids.
- The runtime runs the body at the call, in the calling character's context, and reports inner steps under `scripts[i]/procedures[k]/body[j]`. A call equals the same blocks written inline. Recursion is allowed as in Scratch, but an active call chain deeper than 16 ends the run as `budget-exceeded`; every step still counts against the existing step and virtual-time budgets. A broadcast or layer change inside a body works in a multi-actor run.
- Agorix Code (`define` / `call`), Python and TypeScript (`my_<name>` functions, with accents and symbols removed, repeated names suffixed) and the block adapter derive from the same program. Java and Lua stay on their documented subsets.
- That first slice was model and runtime only; the Escena libre authoring below is the second slice.

## Custom blocks in Escena libre (second slice of #538 iteration 4)

- In Escena libre a child names the last one to three blocks (**Mis bloques**), turns them into one block, and uses it again from that character's palette. The script shows a call in their place; undo restores the originals. Each character has its own blocks (up to 20) and cannot use another character's. Ids are `proc-<character number>-<n>`, names follow the same 1–20 letter, digit, space, `_` or `-` rule as variable names, and the program, import and export all pass through the same validator.
- **Rename** keeps every call working. **Delete** is allowed straight away when nothing calls the block; if something does, the child sees how many uses there are and chooses **Reemplazar usos y borrar** (each call becomes the block's own blocks, so the character does exactly what it did) or **Conservar**. A block that calls itself, directly or through another block, cannot be inlined and is kept.
- A character's blocks count toward the scene limit of 60 blocks. Block names are child-entered text and are not sent to Ori; Ori cannot create, rename or delete a block.
- Blocks shared between characters remain open. Unit tests cover create, undo, equivalence with the original blocks, privacy between characters, rename, delete with and without uses, recursion and the 20-block limit; a mobile browser test with axe covers create, use, play, reopen and delete.

## Ori suggests using a block the child made (third slice of #538 iteration 4)

- When the selected character has blocks of its own, **Pedirle una idea a Ori** may offer to use one of them (**+ Usar: <name>**) as the next block. It is an ordinary reviewable idea: nothing changes until the child chooses **Usar idea**, **Cambiar idea** (swaps to the character's other block; hidden when there is only one) or **No usar**. The same host checks as every other idea apply on the server and again in the browser.
- Ori is told only the block **ids** and the kinds of blocks inside (for example `move`, `turn`), never the child's titles, texts or names; the card shows the title locally. Ori can only name an id that the selected character already has: another character's id, an unknown id, extra fields and any attempt to create, rename or delete a block fall back to the safe local idea. The no-AI path is unchanged (move or turn only).
- The proposal check accepts a call to the child's own block, also inside a repeat, and still validates it against the real script when the idea is applied. Unit tests cover the contract, forged proposals, the model input and the tutor-api route with the real CLI wrapper; a mobile browser test with axe covers review, change, refuse and playing the result.
- Blocks live-shared between characters remain open; a character can be given a copy (see below). Visible by default like the other creative tools (#539); the adult Ori switch still controls whether suggestions appear.

## Numbers in Mis bloques (parameters, fifth slice of #538 iteration 4)

- A custom block can have up to three titled numbers (`Procedure.params`, ids `p1`–`p3`, unique titles of 1–20 characters). A block inside it follows a number through `stepsFrom`, `degreesFrom`, `secondsFrom` or `countFrom`, or through a `param` expression in a variable or list slot. The fixed value stays in the program as the default, so anything that ignores numbers still reads a valid program. A call carries its values as `args` (fixed numbers only; a block cannot yet pass its own number to another block).
- The runtime keeps a frame per call and **clamps** an out-of-range value instead of stopping: steps and turns to ±1000, waits to 0.1–5 seconds, repeats to 1–1000 (rounded). Trace entries of numbered calls include `args`. Agorix Code (`define X with a, b` / `call X with 1, 2`), Python, TypeScript and the block adapter derive from the same program.
- In Escena libre the child adds numbers when making a block (or later), picks **Fijo** or a number on each block inside it, and chooses the value at every use. The first block to follow a number gives every existing call that block's value, so behaviour does not change until the child picks another. **Reemplazar usos y borrar** writes each call's own values into the copied blocks. Number titles are child-entered text and are never sent to Ori; Ori suggests only blocks without numbers.
- Unit tests cover validation, clamping, equivalence with the fixed blocks, projections, block round-trip, authoring, undo, removing a number and inlining; a mobile browser test with axe covers create, bind, pick per use, play and reopen.

## Handing a number on to another block (Mis bloques version 3, #735)

- Inside a custom block, a use of another block can take one of the outer block's own numbers instead of a fixed one (`callProcedure.args` accepts a `param` expression of the enclosing block). The runtime reads it from the caller's frame before opening the new one, so the inner block runs with the caller's value; trace entries show the value passed. A passed number outside a custom block, or one the outer block does not declare, is rejected by the validator.
- Agorix Code, Python, TypeScript and the block adapter show the outer number's name in the call. In Escena libre each inner use has a picker listing fixed values and **Número: <outer number>**; a number takes the unit of the inner block it is handed to. **Reemplazar usos y borrar** keeps the link when it inlines an inner block into a block that has numbers.
- Unit tests cover run, validation, projections, round trip, authoring, units and inlining; a mobile browser test with axe covers the journey and reopening.

## Copying a block to another character (#734)

- In **Mis bloques** a child picks another character and presses **Copiar bloque a**. That character gets its own copy of the block and of every block it uses, with new ids (`proc-<character>-<n>`), the same numbers and the same inner links. Copies are independent: renaming, editing or deleting one never changes the other, so a block can never reach into a character that did not receive it. Undo removes the copy; the 20-block and 60-block limits still apply.
- This is deliberately a copy, not a live shared library: the canonical program keeps every block inside one character's script, so runtime, projections, block editor and the privacy rule (Ori only sees ids of the selected character's own blocks) are unchanged. A live shared library would change that model and is not planned.
- Unit tests cover the closure of used blocks, ids, numbers, independence, undo and limits; a mobile browser test with axe covers copy, use, reopen.

## Timer and key sensors (#733)

- Two new canonical expressions: `timer` (the virtual seconds the running script has waited so far; never a wall clock) and `keyDown` (a key name of letters and digits, true while that key is held). A script started by a key counts that key as held; a run may also be given a set of held keys (`keysDown`, constant for the whole run). Both are evaluated by the deterministic runtime, appear in the trace like any condition, and give the same result for the same program and inputs.
- Agorix Code (`timer`, `key X is down`), Python (`timer()`, `key_down("X")`), TypeScript and the block adapter (**Timer**, **Key [K] is down**) derive from the same program.
- In Escena libre the child picks one of the five keys and adds **Si la tecla está pulsada**, groups blocks the same way, saves the time in a variable, or groups blocks to repeat until a number of seconds passes (the blocks must include **Esperar** for time to advance). **Teclas mantenidas al jugar** chooses which keys count as held during Jugar.
- Deliberately not added: the **pointer position**, which needs live per-frame input that only the same-room lockstep session supplies (a follow-up for that surface), and **answer**, because it would store free text typed by a child.
- Unit tests cover the runtime, validation, projections, round trip and Studio limits; a mobile browser test with axe covers the journey and reopening.

## Drawing tools (#538 media creation)

- The Crear and Escena libre drawing canvas now has six tools: brush, eraser, bucket fill, line, rectangle and circle, plus undo and redo (the last 20 steps), flip and clear. Shapes preview while dragging and commit on release; the eraser makes pixels transparent on a character and white on a backdrop. Fill treats near colours as one area (small tolerance) so soft brush edges leave no halo, and its work is bounded by the 256 × 256 canvas.
- Nothing changes in what is stored: the result still goes through the same local image validation and 60 KB bound, stays on the device and is never sent to Ori or a provider. Pixel helpers live in `kidsPaint.ts` with unit tests; a mobile browser test with axe covers fill, undo/redo, eraser, rectangle, flip and clear.
- Still open: a camera or recording tool.

## Drawing: layers, selection, text and filled shapes (#736)

- The canvas now has two layers (**Capa de atrás**, **Capa del frente**): every tool works on the chosen layer, undo/redo/flip/clear cover both, and saving flattens them into the same single bounded image, so storage, validation (60 KB), export and the Ori privacy rule are unchanged. Erasing shows what is behind; on the back layer of a backdrop it paints the white paper.
- **Seleccionar y mover** draws a dashed rectangle; dragging inside it lifts those pixels and moves them (undoable). **Texto** stamps a word of up to 12 letters in the chosen colour and size; it becomes pixels of the drawing and is never stored as text. **Formas rellenas** fills rectangles and circles.
- Costumes: the child already draws, reopens and reselects personal costumes per character in Escena libre; those now use the same canvas. Shapes are drawn as pixels, not as editable vector objects; a vector editor is not planned because the portable format and runtime only carry bounded raster images.
- A mobile browser test with axe covers layers, fill, filled shape, select-and-move, undo and text.

## Extensions: Pen (#737, ADR 0011)

- ADR 0011 is accepted. Extensions are first-party, deterministic capability packs declared per project (`extensions: ["pen"]`, fixed ids, at most four) and switched by the `extensionPen` flag (on by default; the registry and flag mechanism of #545 and `kidsFlags.ts` control it). A project that uses a pack without declaring it, or lists an unknown id, fails validation.
- **Pen** adds five canonical statements: `penDown`, `penUp`, `setPenColor` (six fixed colours), `setPenSize` (1–24 in the model, four widths in Escena libre) and `clearPen`. The runtime keeps a `pen` state in the world only after a pen block ran; each `move`, `goTo`, `glideTo` or `bounceOnEdge` with the pen down adds one line piece (a loop around a move never draws twice), `penDown` leaves a dot, and drawing stops at 400 pieces with a note. Same program, same drawing.
- Agorix Code (`pen down`, `set pen color red`), Python (`pen_down()`), TypeScript (`pen.down()`) and the block adapter (legacy toolbox entries, kept so projects load) derive from the same program. In Escena libre the **Lápiz** group adds the blocks, and the stage draws the lines under the characters. Nothing the child types is stored and nothing is sent to Ori.
- Tests cover the runtime (drawing, colour, size, clear, loops, limit, determinism, declaration), the Studio rules, projections and round trip; a mobile browser test with axe covers drawing, reopening and replay. Music remains the next candidate and needs its own issue.

## Ori's face: expressions from real events (#600)

- Ori had only a star glyph and six small motion states. It now has a face (`OriFace`, inline SVG, decorative) with six expressions: neutral, curious, thinking, happy, celebrate and encourage. Every expression comes from something that really happened (`kidsOriExpression.ts`): a request in flight shows **thinking**, a waiting idea shows **curious**, the last run's outcome shows **happy** (it ran to the end), **encourage** (it needs another try) or **celebrate** (the mission goal was reached), and accepting an idea shows a short **happy** reaction that clears itself. With no event Ori stays neutral, so it never looks busy or pleased without a reason. There is no sad face: a run that needs another try gets an encouraging one.
- Shown on the Ori button in Escena libre, the floating Ori in the mission editor and the guide, and the Ori card. A custom Ori image set by an adult replaces the face (the motion states still apply). Reduced motion keeps the expression and removes every animation. The face is decorative: the same state is always written in the text next to it.
- Unit tests cover the mapping; a mobile browser test with axe covers neutral → happy → curious → happy and reduced motion. #601 (side panel) and #602–#607 of epic #581 are not part of this change.

## Ori's panel, ghost blocks and real evidence (#601, #602, #605)

- **Non-blocking panel (#601).** Ori's floating help and proposal no longer open as a modal. They are a non-modal dialog (no `aria-modal`, no dimmed backdrop): a side panel on wide screens and a bottom sheet on phones, so the stage and the controls stay operable while it is open. Escape closes it when focus is inside, and focus returns to the button that opened it.
- **Ghost blocks (#602).** While Ori's idea is open, it is previewed in the child's program as a dashed ghost block labelled "Idea de Ori: todavía no está en tu programa", in Escena libre and in the mission editor. The ghost is never saved and never counted as a block; Usar, Cambiar and Rechazar behave as before and undo restores.
- **Real evidence to catch mistakes (#605).** In Escena libre the idea card shows what the deterministic runtime does with a copy of the program: where the character ends and how many blocks run now, and with the idea, with a warning when the program would no longer reach the end. Nothing is invented: it is the same runtime on the same inputs. The child can then use, change or reject the idea.
- Tests: mobile and desktop browser tests with axe cover the panel, the ghost, the evidence, reject and use.

## Ori's goals, explanations and questions (#603, #604, #606)

- **Goal to blocks (#603).** In Escena libre the child picks a goal from a closed list (**Avanzar bastante**, **Hacer un cuadrado**, **Ir y volver**, **Hacer un zigzag**); nothing is typed. `proposeOriStudioIntent` (`@agorix/ori-agent`) turns it into a short, validated, multi-block proposal for the chosen character with the same host checks as a single idea (allowed blocks only, the character's own script, a fresh base program, at most 8 blocks, room in the 60-block scene). It is a deterministic fallback that needs no model and never applies anything by itself: the blocks appear as ghost blocks with the runtime evidence of #605, and **Usar idea** applies them as one undoable step. The model-backed planning of goals belongs to the Ori repository (#18, #19); this is only its adapter and presentation.
- **Explaining a run from its trace (#604).** After **Jugar**, "Ori mira lo que pasó" lists plain sentences read from the runtime trace of the chosen character: how many blocks ran, where it started and ended, how often a condition said yes or no, the first move that did not change the position, and, when the run stopped early, the real last step. A sentence is written only when the trace shows it; Ori does not guess a cause. Block names are the palette names, not internal ids.
- **Predict, then reflect (#606).** Before playing, the child may guess where the character will go (right, left, up, down or stays); after the run Ori says whether the guess matched the real direction. One question follows by age band: 6–8 "¿Pasó lo que esperabas?", 9–12 "¿Qué bloque movió a …?" (checked against the blocks that really moved it), 13+ "¿Cuántos bloques se ejecutaron en total?" (checked against the trace). Answers are not stored. Predictions and reflections are optional and never block playing.
- Tests: unit tests for the direction, facts, explanation, judgement and reflections; the Ori package tests the goal proposals (accept, reject, tamper, stale base, room); mobile browser tests with axe cover goals, ghost blocks, undo, prediction and the three age bands.

## Kids UX polish: copy, targets and phone/tablet layout (#595, #597, #598)

- **Voseo (#597).** The Spanish hints and titles of the missions and the first-mission feedback used the "tú" imperative ("Mira", "Prueba", "Elige", "tienes"). They now use voseo ("Mirá", "Probá", "Elegí", "tenés"). `copyAudit.test.ts` scans every child-facing source file and fails on a tuteo imperative at a sentence start or a "tú" verb form, so it cannot come back unnoticed. The map icons were already announced; they now also have a visible line that names them (Secuencia, Giros, Repetición), for readers and non-readers.
- **Targets and contrast (#598).** Every form control in Kids is at least 44 px: selects (also in width), text and number fields, range sliders, and checkboxes and radios through their 44 px label. A contrast failure introduced while writing the map legend was caught by the new check and fixed.
- **Layout matrix (#595).** `kids-mobile-matrix.spec.ts` walks the map, Crear, Escena libre, Mis proyectos and a mission at 390×844 and 820×1180 and fails on sideways scroll, any control under 44 px, any serious or critical accessibility issue, or Ori's button overlapping Jugar. It attaches a screenshot of each screen to the test report.

## Kids routes and one selection in Crear (#594, #596)

- **Routes (#596).** The address now follows the screen as a URL hash: `#/mapa`, `#/crear`, `#/proyectos`, `#/adultos`, `#/mision/<n>/<mundo>`, `#/libre/<id>`, `#/escena/<id>` and `#/avanzado/<…>`. Reloading returns to the same mission, scene or project, and Back and Forward move between screens without losing the blocks, because scenes and free projects already save on every change. The hash holds only a screen and an id the app made itself, never a name or text. An id that no longer exists, an unknown screen or a malformed hash falls back to the map, and a child who has not finished the first-run steps is not skipped past them by an address. A mission's unsaved blocks are not part of the address.
- **Two remembered choices (#594).** Crear keeps two choices apart, both stay marked and neither unmarks the other: the **explorer** of a single-character world (emoji or an own image) and the **character of Escena libre** (the gallery, with Nova chosen by default so the page never asks the child to pick). The backdrop is one shared choice. All are remembered on this device (`agorix.kids.create.v1`, fixed ids only, validated on load; an older save that had one choice becomes the scene character if it was a gallery one). Escena libre starts with its character and, when the backdrop is from the gallery, that backdrop; the single-character world keeps using the explorer.

## Adult access (#599)

- The grown-ups area no longer asks a fixed puzzle ("7 + 5") that was the same for everyone with unlimited tries. A new adult solves a fresh calculation (different every time), chooses a 4–6 digit PIN and repeats it; afterwards the PIN is asked. It is stored only as a salted PBKDF2 hash on this device, obvious PINs are refused, five wrong tries make the keys wait (30 seconds, doubling to 15 minutes, even for the right PIN), and "Me olvidé el PIN" resets it through a fresh calculation, so it works offline. This is a speed bump on the device, not authentication: anything that needs real trust still asks the adult's account sign-in. `docs/safety/ADULT_ACCESS.md` is the threat model with the residual risks.

## Dragging blocks in Escena libre (#593, partly)

- **Drag in.** Any **+** button of the panel can be dragged into the program: dropping it presses that same button, so a drag and a tap always do exactly the same thing (same values, same validation, same undo). An empty program shows a "Soltá acá para agregar" drop area, and a drag released elsewhere adds nothing. A mouse or pen drags after moving 8 px; a touch needs a 250 ms hold first, so scrolling the panel still works.
- **Reorder.** Each block has a drag handle (**Arrastrar bloque N**) and **Subir/Bajar bloque N** buttons for the keyboard and screen readers. `moveStudioStatement` changes only the order, as one undoable step, and the new order saves, runs and projects like any program.
- **Into and out of repeat and if (completes #593).** Blocks inside a repeat, repeat-until or if now have the same handle, Subir/Bajar and a **Sacar del bloque** button. A block can be dragged into a body or out of it, within a body or between the "then" and "else", and a block dragged from the panel lands inside a body when it is dropped there (the button adds it, then it moves to the drop place). `moveStudioStatementTo` does it as one undoable step; it refuses to put a block inside itself, to leave a body empty, or to exceed the Studio's body and nesting limits.
- **Between characters.** A top-level block (a whole repeat with what is inside it too) can be dragged onto another character's button, which highlights as a drop target, and it goes to the end of that character's program (`moveStudioStatementToActor`, one undoable step). A block that uses a custom block stays with its character, because those blocks belong to one character.
- **Keyboard and screen readers.** Every block has a "Mover bloque a…" choice listing the characters to give it to and the bodies it can go into, so nothing depends on dragging.
- **Kept on purpose.** The **+** buttons and the selects stay: they carry every value and are the keyboard path, so they are not replaced by snap-together blocks. The touch hold-and-drag is implemented but not covered by an automated test (the browser test tool cannot drag with touch); the mouse drag, the buttons, the choices and the model are.

## Ori comes alive (follow-up to #600)

- The first face was too small and too still to notice. Ori is now a small character (`OriFace`, 120×120 inline SVG): a body that floats and breathes, an antenna with a light, eyes that blink and glance around, cheeks, eyebrows and a mouth that **talks** while Ori has something to say. The six expressions are clearly different: curious (tilted head, one raised brow, a "?"), thinking (eyes up, thought dots), happy (closed smiling eyes, bounce), celebrate (open smile, hop and sparkles), encourage (a wink, a nod and a beating heart) and neutral. Reduced motion keeps every expression and removes every movement.
- It is shown large where Ori speaks: above the idea in Escena libre, at the top of Ori's panel and of the guide, and at a readable size in the small buttons and the mission card. The panel no longer repeats a second Ori inside its card, and on wide screens it sits below the top bar so the editor's own buttons stay visible. The floating guide is not drawn in Escena libre, where Ori is already on the page.

## Java in full (E7: #627, #628, #629, #630)

- **Whole vocabulary (#627, #628).** The Java view used to cover seven statements. It now projects every statement, expression and trigger the runtime can run (movement and looks, sound, variables and lists, conditions and loops, key, click and message events, broadcasts, custom blocks with their numbers, the pen, the timer and key sensors). A program is a `class AgorixProgram extends Sprite`; variables and lists are fields, custom blocks and events are methods, numbers are `double`, conditions are `boolean` and converted as the runtime does. Names a child chose never clash with Java words or with each other.
- **Proof, not claim (#630).** A corpus test uses every operation of the runtime's allowlist, so adding a statement to the runtime without teaching Java fails the build; a real Escena libre scene is projected too. Both must have no unsupported node, and the text is **compiled with `javac`** against a stub of the support API (`JAVA_SUPPORT_STUB`), which a second test keeps in step with the list of methods.
- **In Escena libre (#629).** The code panel follows the adult's age band like the mission editor does: 6–8 starts with Agorix Code and opens the rest on request, 9–12 offers Agorix Code, Python and TypeScript, 13+ also Java; with the age-band switch off every language is offered. Stepping through a run (**Paso**) highlights the line of the block that is running, in every language.
- Display only: nothing here is run or sent anywhere.

## Mastery stages from runtime evidence (E4: #609, #610)

- **Model (#609).** Six concepts taken from the competency catalog (sequence, events, repetition, conditions, variables, custom blocks) and six stages for each, the same ladder for all: **Descubre, Imita, Prueba, Crea, Explica, Enseña** (spec `docs/superpowers/specs/2026-10-26-kids-mastery-stages-design.md`, approved by the owner). The rules are a pure function of small counters in `@agorix/learning-evidence` (`mastery.ts`), versioned (`MASTERY_VERSION`; an older state is read as empty rather than guessed at), and every transition has a test.
- **Evidence (#610).** Only deterministic things move a child: a run that finished or not, whether it used help (an accepted Ori idea or an opened hint), a free creation, a prediction or reflection that matched the run, and a custom block called at least twice. Studio runs and the mission editor record it; the child's own "did it happen as you expected?" answer is not evidence. Three failed runs in a row lower a stage by one and the next completed run restores it; nothing else lowers it and no count is ever removed. Nobody can hand out stages, and a stored stage is recomputed from the counters, never trusted.
- **Kept on the device only** (`agorix.kids.mastery.v1`): counters capped at 99, the stage, and the last 20 changes with a day, the stages and a reason code from a fixed list. No program, no text, no project or actor id, no time of day; it is read field by field and anything else comes back empty. Never sent to Ori or any provider.
- **Not in this slice, as agreed:** no screen shows it, and Kids and Ori do not adapt to it yet (#611); the band profile and the onboarding without a birth date (#607, #608) and new worlds (#612) follow. `explainMastery` already produces the plain sentences for the grown-ups' summary.

## Ori confiable (E1, iteración 2)

- ORI-01/02/03: el chat de Ori ya no responde "no está disponible". Sin modelo (o con salida inválida) clasifica la consulta con reglas locales y responde con frases canónicas contextuales, incluidas respuestas empáticas (`stuck`, `sad`, `bored`, `help`, `hello`, `thanks`, `again`). Todas pertenecen a la lista cerrada que valida `isOriChatReply`; el texto del chico nunca se repite ni se envía al prompt.
- ORI-04: Ori no ofrece una solución al entrar a una misión. La idea con bloques aparece después de una corrida que no llegó a la meta o desde la pista 2 (`gateKidsOriOffer`). En Estudio libre el aprendiz pide la meta, por lo que no cambia.
- ORI-06: matriz adversarial determinista (`chatAdversarial.test.ts`): consultas válidas, inyección, privacidad, temas inseguros, fuera de alcance y salidas hostiles del proveedor. Encontró y cerró un hueco: "drogas" (plural) no se rechazaba.
- ORI-07: contadores agregados por clase y hora (24 h, solo en memoria) en `GET /api/tutor/admin/ori-stats`, visibles en el panel de administración. No guardan texto, prompts ni identificadores; hay prueba de que el módulo no persiste.

## Sonido creativo, primera entrega (E6 / SND-01)

- La galería pasa de 12 a 72 sonidos en 8 categorías (Efectos, Música, Naturaleza, Animales, Vehículos, Magia, Avisos, Acciones) con búsqueda sin acentos ni mayúsculas, en español e inglés, y preescucha.
- **Licencias:** en vez de grabaciones CC0 de terceros, los sonidos son presets sintetizados propios (un oscilador acotado, ≤0.5 s, definidos en `kidsSoundCatalog.ts`). No hay licencias ajenas que auditar, funcionan sin conexión y entran en el bundle sin assets binarios. Sonidos grabados o importados quedan para SND-02.
- Los ids `kids:*` son estables; los proyectos anteriores siguen abriendo igual.

## Música y efectos de sonido (E6 / SND-04 y SND-05)

- Paquete de extensión `music` (ADR 0011), activable con el flag `extensionMusic` (por defecto activo): tocar nota, tocar percusión, instrumento, velocidad (tempo), tono y lado del sonido (pan). Todo son listas cerradas y números enteros chicos; no hay grabación ni red.
- Reproducción determinista: la traza del runtime lleva `audio` con instrumento, tono, pan y duración (`beats × 60 / tempo`). El parlante programa las entradas una tras otra (cada nota espera a que termine la anterior), con un tope de 64 eventos y 30 s. Un proyecto sin música suena exactamente igual que antes.
- Los seis bloques están en las cuatro proyecciones (Agorix Code, Python, TypeScript, Java), en el adaptador de bloques y en el Estudio, con corpus Java compilado con `javac`.
- Límites: los sonidos de la galería (SND-01) no se alargan con la nota; el tono y el lado afectan también a `playSound` desde el primer bloque de música. Ori todavía no propone melodías (SND-06).

## Ori propone sonido y melodía (E6 / SND-06)

- Tres metas nuevas en la lista cerrada del Estudio: tocar una melodía (campanas, Do-Re-Mi-Fa-Sol), hacer un ritmo (bombo, redoblante, palmas) y festejar con sonido. Son deterministas, no usan modelo y el modelo nunca recibe audio ni texto del chico; solo ids de la lista.
- Preescucha: el botón "Escuchar la idea" corre una copia candidata y reproduce su traza; el programa del chico no cambia hasta "Usar idea". Un parlante bloqueado no afecta nada.
- Lista permitida más estricta que la del Estudio: notas blancas Do 4–Do 5 de ½ o 1 tiempo, percusión de ½ o 1 tiempo, velocidad 90 o 120, sonidos `kids:win/sparkle/bell/tada`; cualquier otra cosa se rechaza al validar.
- Al aceptar una propuesta que usa un bloque de un paquete, el programa declara el paquete (`extensions`) automáticamente; el validador sigue exigiéndolo.
- Los intents de música se ocultan si el flag `extensionMusic` está apagado.

## Editor de sonido reversible (E6 / SND-03)

- En Adultos, cada audio propio guardado tiene "Editar audio": forma de onda, recorte con dos deslizadores, dar vuelta, más fuerte/suave, entrada/salida suave, más rápido/lento, escuchar, deshacer y rehacer. Guardar reemplaza el audio con un WAV mono limpio (sin nombre de archivo ni metadatos) que pasa por la misma validación de importación (≤ 5 s, ≤ 500 KB).
- Límites de memoria: mono a 22 050 Hz, 5 s como máximo (110 250 muestras), historial de 12 pasos; un recorte no puede dejar menos de 0,1 s; "más lento" nunca supera los 5 s.
- Todo ocurre en el dispositivo: no hay red, y el audio sigue en IndexedDB.
- **SND-02 (grabación con micrófono) sigue abierto por decisión del dueño (2026-10-26):** la política `Permissions-Policy` mantiene `microphone=()`. Habilitarlo requiere antes la revisión de privacidad de voces infantiles; la importación supervisada de archivos ya existe.

## Comportamiento administrable, primera entrega (E5 / ADM-01, 03, 05, 06)

- **Registro tipado (ADM-01):** `ai-config` pasa a `v3` con una sección `behavior` propia (validador, valores por defecto y piso de seguridad). Los documentos `v1` y `v2` se leen y migran; un cliente viejo que publica no puede reiniciar ni el modo grupo ni el comportamiento ya publicado. Historial, rollback y control de revisión son los de #545.
- **Intervención de Ori (ADM-03):** `behavior.intervention` fija cuántas corridas fallidas (1–5), desde qué pista (2–5; la pista 1 nunca alcanza) y cuántos bloques por idea (1–8). Los límites no se configuran: Ori nunca ofrece una solución al entrar y los validadores siguen decidiendo. El navegador solo recibe tres números en `GET /api/tutor/behavior`; sin red o con una respuesta inválida usa los valores por defecto, que son los más seguros. La regla es la misma función (`shouldOfferOriIdea`) en cliente y servidor.
- **Aprendices simulados (ADM-05):** la vista previa del panel muestra, para seis situaciones inventadas (nunca datos reales), si Ori ofrecería una idea y de qué tamaño. Previsualizar no publica.
- **Gate automático (ADM-06):** antes de publicar, el servidor corre pruebas fijas: texto adicional que intente anular reglas, piso de intervención, metas suficientes, entradas hostiles al chat (ni llegan al modelo; salidas hostiles del modelo se reducen a frases fijas) y validez de todas las metas. Un fallo devuelve solo códigos (`422 gate-failed`) y no guarda nada.
- **Pendiente de E5:** ADM-02 (definiciones por capacidad), ADM-04 (catálogos de misiones y textos; incluye rechazar misiones insolubles) y ADM-07 (despliegue gradual por grupo o porcentaje). El gate todavía no evalúa solubilidad de misiones porque aún no se administran.

## Agentes por capacidad (E5 / ADM-02)

- Cuatro roles sobre las capacidades de Ori: **clasificador** (chat), **coach** (misiones), **proponedor** (escenas y avanzado) y **compositor** (objetivos). Cada uno tiene contrato versionado, salidas cerradas y qué recibe (`getOriAgentDefinitions`). Solo el clasificador ve el texto del chico, siempre como dato y nunca dentro de las instrucciones; los demás reciben solo ids.
- El panel de administración muestra, en cada capacidad, el rol, el contrato, lo que puede devolver, las seis reglas fijas y las instrucciones completas que recibe el modelo (`GET /api/tutor/admin/agents`, solo con sesión de admin; el navegador de los chicos nunca las recibe).
- Seguridad no configurable a la baja: el texto del administrador entra solo mediante `composeOriInstructions`, después del contrato fijo y con la etiqueta `ADMIN_ADDITIONAL_INSTRUCTIONS`; el mismo código lo usa el servidor y la vista previa. El gate de publicación comprueba que cada agente conserve su contrato (`agent-contract`).
- Los esquemas y prompts base siguen en el código y se editan con revisión, no desde el panel: lo editable es proveedor, modelo, límites y la instrucción adicional.
