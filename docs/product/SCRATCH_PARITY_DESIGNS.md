# Scratch parity, the large items: designs for review

Part of [#1315](https://github.com/Modern-Ash/agorix/issues/1315). The owner decided on 2026-11-09 to build the four large items below. This says how each one is built without giving up the product rules: the program stays canonical and deterministic, Ori only proposes, nothing a child makes leaves the device, and everything works without AI.

Nothing here is built yet. Each section ends with the increments, each one a reviewable PR, and the question the first PR must settle.

## Decisions (owner, 2026-11-09)

1. **Costume and backdrop editor (#1308):** draw, import and retouch. Not only a simple vector tool.
2. **Own sounds (#1309):** the child may record with the microphone, behind an adult switch.
3. **Sensors (#1304):** typed answer, microphone volume and touching a color are all in.
4. **Clones size A (#1311):** a copy may have its own script (the clone hat).
5. **No `.sb3` corpus is available** for #1312, so import fidelity is measured on projects the team builds, not on the owner's.

## Rules that apply to every section

- A child's drawing, recording or typed answer is **local**: stored in the project on the device, never sent to a server, a model or a log. Findings and the provider input carry kinds and counts only (the existing `toProviderFinding` rule).
- Every new capability sits behind an adult switch that is **off by default** if it uses the microphone, and every new asset kind has a size cap and a count cap, validated on load and on import.
- Ori proposes through the existing path (preview, accept, change, reject, one undoable step). Where the proposal contract cannot express the change today, the contract is extended first, with the same validation, never bypassed.
- Each capability needs a fixture where it works, one where it must not, and a test that a project using it still runs with no AI and no credentials.

## 1. Costume and backdrop editor (#1308)

**What exists.** Costumes and backdrops are chosen from a gallery by id, plus images an adult or child imports (`customImages`). The canonical project stores asset ids; the art itself is an immutable bundled file or a data URI the importer validates. There is no way to change a picture.

**What is built.** A bounded editor that produces a new asset the project owns.

- **Document model.** A vector document: an ordered list of shapes (rectangle, ellipse, line, free stroke, text of at most 20 letters) with a fill, a stroke, a stroke width from a closed list, and a position and size, at most 60 shapes. It is serialisable, versioned, and rendered to SVG by one pure function. The runtime never sees it; the stage shows the rendered picture, like any asset.
- **Import and retouch.** An imported picture (PNG, JPEG, SVG after sanitising) becomes a bitmap layer of the document, scaled to the costume size and capped in bytes. Retouch means the vector tools and an eraser drawn over it, plus crop and flip. Pixel filters are out of scope.
- **Storage.** A saved edit becomes a new costume asset (`costume:custom-N`) in the project, next to the originals, which stay immutable. Undo and redo are per document. The project export and import carry it, with the same limits.
- **Safety.** SVG is sanitised (no scripts, no external references, no `foreignObject`), every size is bounded, and an oversize file is refused with a clear message, as the existing image import does.
- **Interface.** A full-screen editor opened from the character or backdrop properties, with large touch targets, keyboard shortcuts for every tool, and a text description of the picture for screen readers built from the shape list.

**Ori.** Ori may propose a **variation**: a changed copy of the document (bigger, another color, mirrored) shown as a preview beside the current one, which the child accepts, changes or rejects. This is the new part of the contract: today a proposal changes blocks. A proposal kind `replaceAsset { assetId, document }` is added to `@agorix/proposals`, validated like a statement change (the document must be valid and within the caps) and applied as one undoable transaction. Ori never draws unseen and never edits a picture directly.

**Increments.**

1. The document model, the SVG renderer, the sanitiser and the caps, with tests and a corpus of hostile SVGs. No interface.
2. The editor with shapes and strokes, saving a new costume or backdrop; e2e on touch and keyboard; accessibility.
3. Import and retouch (bitmap layer, eraser, crop, flip).
4. The `replaceAsset` proposal and Ori's variation, with the deterministic fallback "no suggestion".

**First question to settle.** Where the bitmap bytes live: inline in the project (simple, bounded by the cap) or in the existing asset store. The proposal is inline with a 256 KB cap per picture and a project cap, because the project already travels as one file.

## 2. Own sounds (#1309)

**What exists.** A synthesized library and adult-supplied audio behind `customAudio`. The runtime plays sounds by id and records `soundId` in the trace.

**What is built.**

- **Recording.** A child records up to 5 seconds, listens, trims the start and end, and names it from a closed list of words or a short text. The recording is stored as an asset of the project (`sound:recorded-N`), mono, 16 kHz, a fixed encoding, at most about 160 KB, at most 8 per project.
- **Adult switch.** The microphone is requested only after an adult turns the switch on in the adult area, per device. Without it the record button is not shown. The browser permission prompt is the second gate. Both gates are tested.
- **Privacy.** The audio never leaves the device: no upload, no model, no log, no analytics event beyond a whole-number counter "sounds recorded" shown to the adult. The microphone stream is stopped as soon as the recording ends, and the interface shows a visible recording state. Deleting the project deletes the audio.
- **Playback and determinism.** The runtime plays a recorded sound exactly like a bundled one (an id and the trace entry). The audio bytes are display and playback output, never executed, never part of the run's result.
- **Interface.** Record, stop, play, trim handles with keyboard control, delete. A captions-style label tells the child what is playing.

**Ori.** Ori suggests which sound fits what happens in the run (the finding for a silent sound exists) as a normal `playSound` proposal. Ori never hears or sees the recording and cannot name it from its content.

**Increments.**

1. The audio asset model, the caps, the encoder and the project import and export, with tests; no interface.
2. The adult switch and the recording interface, with a fake microphone in tests.
3. Trim, rename and delete; e2e and accessibility.

**Risk to settle.** The browser's `MediaRecorder` codecs differ across browsers. The proposal is to record to PCM through an audio worklet and encode in our own code, so the stored format is the same everywhere and tests can compare bytes.

## 3. Sensors (#1304)

**Reset timer** is done (#1323). The rest, each with its own gate:

- **Typed answer ("ask and wait").** A block asks a question from a closed list of prompts or a short phrase the child writes (at most 40 letters), shows an input on the stage, and stores what the child types (at most 20 letters) in a text variable. The typed text stays in the text variable (the text values slice, #1319). It is never in the trace as a string the model could read: the trace records that an answer was given and its length. The run waits for the answer using the same mechanism as `askChoice`, so the live runtime and the replay log keep it exactly.
- **Microphone volume.** A reporter `loudness` (0 to 100) read from the microphone, behind the same adult switch as recording. The runtime samples it once per tick, like keys and the pointer, and logs a change in the input log, so a replay reproduces the run without a microphone. Only the number is kept, never the sound. Without the switch the reporter is 0.
- **When loudness passes a value.** The hat of #1305 that was left open: starts the script when the loudness first passes a value from a closed list. It reuses the sampling above.
- **Touching a color.** A condition true when the character overlaps a color of a closed palette (the same colors as the pen) drawn on the stage: the pen trail, the backdrop's main color zones, or a stamped copy. Defined on the **rendered scene model**, not on pixels: the backdrop declares its color zones as rectangles and ellipses in its art metadata, and the pen trail is the segment list. That keeps it deterministic and testable without a canvas. A bundled backdrop without zones answers false.

**Ori.** The existing "condition never true or false" finding already covers the new sensors. Ori also notices an `ask` whose answer is never used and proposes the block that uses it.

**Increments.** (1) Typed answer with the replay and privacy tests. (2) The loudness sampling, the adult switch and the reporter. (3) The loudness hat. (4) Color zones on the bundled backdrops and the touching-color condition.

## 4. Clones size A (#1311)

Follows the sizes in [CLONES_DESIGN.md](CLONES_DESIGN.md); size B (copies without scripts) shipped in #1298, with the cap of 20 live copies.

**What is built.**

- **The clone hat.** A new trigger `whenIStartAsClone` and a statement `deleteThisClone`. A character may now have **two scripts**: the main one and the clone script. The Studio's rule "one script per character" becomes "one main script and at most one clone script"; the ids `studio-actor-N-<character>` gain a suffix for the clone script, and every place that reads those ids is updated and tested.
- **`createClone` of itself.** The `createCopies` block gains a mode "with its behavior": each copy starts the character's clone script at the moment it exists, at the copy's own position. The three rules (spread, fall, follow) keep deciding where it starts; a copy with a script then moves by its own script and the rule's automatic motion stops for it.
- **Runtime.** The live runtime and the batch runner add run-only actors with ids from a counter (`<actor>#N`), deterministic and replayable, capped at 20 live across the run (shared with size B). A clone's script runs through the same stepper as any activation. Clones end on `deleteThisClone`, when the character stops all, or at the end of the run.
- **What clones see.** A clone reads and writes the global variables, hears broadcasts, and is reachable by other characters only through messages and `touching <character>` (which counts the original and its clones). It has no private variables in this size.
- **Findings and timeline.** Frames already hold actor snapshots; clones appear and disappear in them, and the timeline marks their birth and end. Findings treat clones as part of their character (a clone script that never starts is a `neverStarted` for the character).
- **Views.** The four code views, the Blockly adapter and the Studio palette get the hat and `deleteThisClone`. The Scratch importer maps `control_start_as_clone` and `control_delete_this_clone`, and keeps mapping `create clone of myself` to the new mode when the project has a clone script, otherwise to size B.

**Ori.** The ideas "rain" and "crowd" gain a scripted version (each drop falls and is deleted at the bottom). Ori also explains a clone that never ends before the cap hides new ones, from the trace.

**Increments.**

1. The trigger, the statement, the validator, and the second-script rule in the Studio model; no runtime.
2. Runtime support, batch and live, with replay tests and the cap.
3. Studio palette, stage drawing, timeline marks and findings.
4. Views, Blockly, importer, and the scripted Ori ideas.

## Order

Independent and parallelisable: the text slices already merged make sensors easy, so start with **sensors (1, 2)**. Then **clones A (1, 2)**, then the **editor model (1)** and **audio model (1)**, which are model-only and safe. The editor and recording interfaces come last because they need the child sessions (#1314) to validate that they are usable.

## Constraints that stay

The runtime stays deterministic and the trace stays the evidence; a project with every new capability runs with no AI and no credentials; nothing a child draws, records or types leaves the device; Ori only proposes, and every proposal is validated and reviewed like any other.

## Status: sensors (#1304)

Done: reset timer (#1323), typed answer (#1329), microphone volume and its hat (#1332, #1333), and touching a colour over a **backdrop's colour zones**: the expression `touchingColor { color }` (closed pen palette), with each bundled backdrop's sky and ground as zones in the creative state (`colorZones`, validated and bounded), so the runtime answers on the scene model and never reads pixels. A backdrop without zones (every imported one) answers false. The Studio offers it as a condition ("está sobre el color …"); the Scratch importer maps `sensing_touchingcolor` to the nearest pen colour by hue.

Not done: touching the pen trail or a stamped copy. Each character's pen lives in its own world, so reading another character's trail needs the scheduler to share trails first; it is left for its own slice.

## Status: costume and backdrop editor (#1308), increment 1

Built: `@agorix/art-document`, with no interface. The document (v1: rectangle, ellipse, line, free stroke, text of at most 20 letters, imported bitmap; closed palette of 16 colours, closed stroke widths and text sizes, whole-number coordinates inside the canvas, at most 60 shapes, 64 points a stroke, 2 pictures), one pure renderer to SVG, a description for screen readers built from the shapes (es/en), and the SVG sanitiser (tokenizer, element and attribute allow-list, checked values, rebuilt output; scripts, handlers, links, styles, external references, entities and oversize or too-deep pictures are refused) with a corpus of 37 hostile pictures.

One correction to the design: a bitmap layer keeps the **existing project rule** (PNG or WebP, under 60 KB, `validEmbeddedImageSource`), not the 256 KB the design proposed. JPEG and SVG imports must therefore be rasterised to that format by the browser in increment 3, and a saved edit becomes a costume asset by the same route; the vector document is kept next to it so it stays editable.

## Correction and status: Ori's variations of a drawing (#1308)

The editor section above said a child cannot change a picture. That was wrong: `KidsDrawArt` already draws (brush, eraser, fill, line, rectangle, circle, text, select and move, two layers, undo), imports an image and edits a saved drawing again. What was missing, and is now built, is what Ori adds: **ideas for the child's own pictures**. A closed list of six (mirror, flip, quarter turn, change the colours, lighter, darker), each a fixed transformation of the pixels already there, computed locally. Ori does not draw and no model is read. The idea is shown beside the picture, nothing changes until the child presses "use", and "go back to the drawing from before" restores it. It reaches the picture through the existing `updateStudioArt`, which keeps the project rules (PNG or WebP under 60 KB).

This did not need a new proposal operation: a picture is a project asset, not part of the program, so the program-proposal contract is untouched. The vector `@agorix/art-document` package stays as the base for descriptions of a drawing for screen readers and for editable shapes later, if sessions with children show they are wanted.

## Status: words for the child's own pictures (#1308)

A picture the child drew or imported had no text for a screen reader. Now each one is described in a short sentence ("Tu dibujo: ocupa buena parte, con azul, verde y blanco."), worked out on the device from the pixels alone, from a closed list of eleven colour words and three coverage phrases. No file text, no model and no network are involved, and the sentence is deterministic. It is the accessible name of the character on the stage and of the stage backdrop, and it is read beside each entry of "Mis disfraces" and "Mis fondos". A picture that cannot be read keeps just its name. Shapes and what a drawing _depicts_ are not claimed: only colours and how much of the picture is drawn.

## Status: own sounds (#1309), recordings in the project

Recording, trimming, keeping the recording as a project sound, playing it from a block, exporting it only with the adult's opt-in, and deleting it (refused while a block plays it) are built. Ori never hears or names a recording.

## Status: costume and backdrop number (#1307)

Two number reporters, `costumeNumber` and `backdropNumber`, count from 1 in an order the project lists: the character's own costume first, then the child's own pictures in the order they were made; for the backdrop, the scene's backdrop first, then the child's own. A costume or backdrop that is not listed is 0. The order is part of the creative state (`costumeOrders` by actor, `backdropOrder`), validated against the project's assets, so the runtime never guesses it. A clone counts like its character. The scene offers them as "wears a costume other than the first" and "the backdrop is not the first", only once the child has a picture of their own. The Scratch importer reads "costume number" and "backdrop number"; the name versions are reported as left out. Names are not offered because a name is text the child wrote.

## Status: Scratch variables that hold words

The Scratch importer now keeps a variable as a **word variable** (up to three, the scene's text values) when it starts as a word or the project sets it to a word, and numbers stay numbers. "Set to" a short word (at most 20 letters, no control characters) or to another word variable becomes `setText`; anything longer, or "change by" on a word variable, is left out and reported. The scene's variables start empty, so a starting word is not kept. Lists of words are still not offered: they need their own statements and reporters in every layer and a decision on how child text appears in watchers, so they are a separate design.

## Status: custom block numbers (#1310)

"Mis bloques" and "Bloques para todos" accept at most **five** named numbers, with positional ids `p1` through `p5`. Five keeps the call and its inputs bounded on a small screen while allowing a child to pass more than the former three values. The validator rejects a sixth number and calls with the wrong arity; the scene hides the add control at five. Removing a number renumbers the remaining inputs and updates calls in one undoable step. The runtime and all code views read the same canonical inputs.
