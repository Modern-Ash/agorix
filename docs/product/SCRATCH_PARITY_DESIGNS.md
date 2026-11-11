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

Current time (#1304): the expression `currentTime { part }` reads one of year, month, date, day of week, hour, minute or second as a whole number. The caller captures the clock (the runtime never reads a global); the live runtime samples it each tick and logs it in the input log only when it changes, so a replay needs no clock. Without a clock every part is 0. The Studio offers "it is afternoon" as a condition; the Scratch importer maps `sensing_current`.

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

## Status: pen shade (#1306)

Stamp and pen transparency were already in. The pen now also has a **shade**, `setPenShade { shade }` from the closed list lighter, normal, darker (normal is the colour as chosen). It stays inside the pen pack (ADR 0011): the validator marks the pen as used, the world keeps the shade on the pen and on each segment drawn while it is set, and the stage pulls the colour a third of the way to white or black. A free number is not offered, so a trail stays easy to read. The Scratch importer still reports the pen shade blocks as left out. All four code views and the block editor read the same canonical statement.

## Status: Scratch import fidelity (#1312), increment 1

The importer now also reads blocks the scene already had but the importer did not map: pen size, pen colour (a swatch becomes the nearest pen colour), pen transparency and brightness or shade (to the three shades), reset timer, and the hats "when timer > N" and "when loudness > N" (to the nearest value the scene offers). Each snapped value counts as adjusted in the report. No `.sb3` corpus exists, so the hit rate is still not measured; this increment closes the gap by comparing the opcode list with what the scene supports. Increment 2 adds colour, ghost and brightness effects (set, change, clear) and volume (set, change); other Scratch effects are reported as left out. Still left out and reported: "when backdrop switches to", ask and wait, costume and backdrop switching, lists, and custom blocks.

## Status: Scratch import measured on a corpus (#1312)

There is still no corpus of children's `.sb3` files, so the team wrote ten projects of the kind a child makes (`apps/web/src/kids/__fixtures__/scratch/corpus.ts`, built by a small Scratch 3 JSON builder). They are synthetic: what they show is which blocks the importer handles, not how often children use them. The test `kidsScratchCorpus.test.ts` converts each one, runs the result in the deterministic runtime, and fails if the numbers get worse. The report's own `blocksImported` counts only top-level statements, so the measure counts every nested statement in the converted program instead.

| Project       | Statements | Came across  | Scripts | Kept         |
| ------------- | ---------- | ------------ | ------- | ------------ |
| catch-game    | 15         | 14           | 4       | 4            |
| pen-spiral    | 10         | 9            | 2       | 2            |
| quiz          | 7          | 2            | 1       | 1            |
| maze          | 12         | 12           | 4       | 4            |
| dance         | 9          | 6            | 2       | 2            |
| clone-rain    | 9          | 8            | 2       | 2            |
| timer-race    | 6          | 6            | 2       | 2            |
| music-box     | 5          | 5            | 1       | 1            |
| custom-blocks | 7          | 2            | 2       | 1            |
| ghost-story   | 11         | 9            | 3       | 2            |
| **Total**     | **91**     | **73 (80%)** | **23**  | **21 (91%)** |

Measured at the end of #1363: with Music mapped and up to three scripts per character, 71 of 91 statements (78%) and 21 of 23 scripts (91%) come across. Before, it was 58 (64%) and 14 (61%). What is left, most to least: lists and "my blocks", "ask and wait", switching costume or backdrop by name, "if/else" on an answer, a pen colour step, a value that comes from another block (a random number inside "go to"), and a second script for an event the character already answers.

## Status: more than one script per character (#1363), increment 1

Owner decision (2026-11-10): a character may have more than one script. Working cap: its own script plus **two** more (three), plus the copy script as before. To be confirmed with #1313 and in a learner session before any default changes.

Increment 1 is the Studio model only, with no interface yet. The engine already ran several scripts per character (a character lists its scripts in the creative state), so only the Studio's one-script rule changes:

- Extra scripts are named `studio-actor-N-<character>-s2` and `-s3`, after the characters' own scripts. Rules: slots in order with no gap; each has its own event, never the copy hat and never one the character already answers (so two arrows are two keys, never a repeat); no custom blocks of their own; the character's blocks across all its scripts count against the one block limit.
- They are edited through a target name, like the copy script: `studioExtraTarget(actorId, slot)`, so every editing function (add, remove, move, set the event) works unchanged.
- New: `addStudioScript`, `removeStudioScript`, `studioExtraScripts`; `studioBlocksUsed` now sums the character's scripts; adding a character keeps the others' extra scripts.

Next increments: (2) the Studio interface (a tab per script, add and remove, choose the event); (3) the Scratch importer keeps up to three scripts per sprite; (4) Ori's findings, the timeline and the four code views read every script of a character.

## Status: more than one script per character (#1363), increments 2 and 3

The Studio now shows tabs "Script 1, 2, 3" above the blocks, with "+ Another script" (it starts with the first event the character does not answer yet) and "Remove this script" for the last one. Every block edit, move, copy, delete and event choice goes to the script in the open tab. Choosing an event the character already answers in another script is refused with a message, and the script stays as it was. Custom blocks are made only on script 1. The Scratch importer keeps up to three scripts per sprite, each with its own event, and counts a repeat or a fourth as "another script of the sprite".

Increment 4: the four code views write every script of a character (tested), and Ori's findings read every script because a character lists them in the creative state. Ori's **ideas** land in the character's first script, so the screen jumps to Script 1 while Ori has an idea to show, and the ghost blocks appear where they would go. Making Ori propose for a chosen script is left for when sessions show it is wanted.

## Status: Ori explains what an import left out (#1312)

After a Scratch import, the report now has "Ori tells you why": one fixed sentence per kind of cut, in Spanish and English, grouped and counted (extra scripts, more than twelve characters or three variables, costume or backdrop by name, ask and wait, lists, custom blocks, pen steps, effects, values from another block, conditions, go to or glide, sounds). The sentences are matched from the reasons the importer already reports, so they need no AI and never repeat a name from the file. Where the scene has a close block, Ori can offer it as an idea: **go to a random spot** (for go to another object and glide to), **move a bit** (for a value that came from another block inside Move) and **a sound** (for a sound the scene does not have).

These three ideas are `ORI_IMPORT_INTENTS`, one block each, kept apart from the goals every scene offers. They go through the same path as any idea: the ghost block and its preview, use, change or reject, one undo. They appear in the Ori panel only in a scene that came from an import and had such a cut. What is kept on the device for that is only the closed kinds of cut per scene, never a name or a block from the file, and it is forgotten when the scene is deleted.

Left out on purpose: ideas for the other cuts (lists, ask and wait, costume switching, pen steps, effects). The closed idea contract does not allow those blocks yet, and widening it is a decision for its own change.

## Status: export to Scratch (.sb3) (#1312)

Each scene in "My projects" now has "Export to Scratch". It reads the canonical program (never changes it) and writes a Scratch 3 project: a zip with `project.json` and one SVG per costume and backdrop, stored without compression, so the same scene always gives the same bytes. Sprites keep their position, size and direction (the scene's stage and angles are converted to Scratch's); every script is written under its own hat, including the extra scripts and the copy script; broadcasts, variables and the pen and music extensions are declared.

What is written: movement, looks, size, effects, layers, waits, loops, if and if/else, repeat until, wait until, broadcasts, variables, the pen (colour, size, transparency, shade, stamp), music (notes, drums, tempo, instruments), volume, the timer, copies (written as "create clone of myself", the copy rule is lost) and the conditions and values the scene has. A scene exported and imported again gives back the same blocks with the same values (tested on a scene that uses every one of these), except the copy rule.

**The child's own pictures and recordings go with the scene.** Each sprite's costumes are its character's picture, any other character's picture a block switches to, then the child's drawings in the order they were made; the stage has the scene's backdrop, any other one a block names, then the child's own. A drawing is written as a PNG (a PNG is used as it is; a WebP is redrawn on a canvas on this device, because Scratch does not open WebP). A recording is written as the WAV it already is, with its rate and length, and added to every sprite so any of them can play it. Switching costume or backdrop, playing a recording, and the backdrop hat are now written. A picture the browser could not convert is reported, not dropped silently.

What is not written, and counted in the message after the export: the scene's built-in sounds (they are synthesized, not audio files), questions with a prompt and custom blocks. The standard pictures of the characters are still stand-ins drawn from the glyph and colour.

Found on the way: the importer read "point in direction 90" (Scratch's right) as 180 (left) in the scene. Fixed, with a test.

## Correction: Ori and several scripts per character (#1363)

When more than one script per character landed, Ori's Studio checks still counted a character's extra scripts (`studio-actor-N-<character>-s2` and `-s3`) as characters of their own, did not recognise their ids, and refused the whole scene as outside the Studio. So in any scene where a character had a second script, **asking Ori for an idea failed**, for every character. The tests did not cover Ori in such a scene. Fixed: Ori's checks treat a character's extra scripts as part of that character, and the review lists every script a character owns.

Ori's goals from the closed list now work on the script the child has open: the context can name the script (`scriptId`; absent means the character's first), the ghost blocks appear in that script, one undo takes the idea back, and switching tabs drops an idea made for another script. The ideas that bring a script for the copies are for the first script only. The idea Ori's model offers and the "and / or" idea still land in the first script, and the screen jumps to Script 1 while one of them is shown; the model request to the server is unchanged.

## Status: custom blocks and the second and third script (#1363)

A character's second and third scripts keep no custom blocks of their own (the validator refuses them), but any script can already call a block made for everyone. So on those tabs the "make a block" button is "Make block for everyone": it turns the last blocks of that script into a shared block and puts a call in their place, in one undoable step, and says so beside the button. The first script still makes its own. The new block is checked like any shared one: its name must differ from the shared names that exist, at most five, and the same limit on numbers. The model function is `createSharedStudioProcedure`.

## Status: Scratch lists in the importer (word lists, increment 4)

The importer now keeps up to three Scratch lists (from the stage first) as the scene's lists, which start empty, and reads "add to", "insert at", "replace item of" and "delete of" a list, and the reporters "item of" and "length of". An item may be a number or a short word, as in Scratch: text typed in that reads as a number becomes the number, any other text of up to 20 letters is a word, and a number or word variable and an item of a list are kept as such. Left out and reported: a Scratch list's starting items (the scene's lists start empty), a fourth list, a position that is not a whole number from 1 to 10, "delete all", and a word longer than 20 letters. The corpus goes from 71 to 73 of 91 statements, now counting the list blocks of the "custom blocks" project.

## Status: Scratch lists in the exporter (word lists, increment 5)

A scene's lists are written to the `.sb3`: on the stage (they belong to the whole scene), empty as in the scene, with every list block written as the Scratch block it matches (add, insert, replace, delete, item of, length of) and the list named in its field. A scene with a list that holds numbers and words exports and imports back to the same blocks (tested), including words, numbers, word variables and items read into a variable. One limit of Scratch itself: variables have no type, so a word variable comes back as one only if the program sets it to a word; one fed only from a list item comes back as a number variable.

## Status: Ori's findings on the block itself

After a run, Ori's quiet marker below the stage still says one sentence about what looks wrong (silence is respect: nothing speaks on its own). It now also puts a small mark where the problem is, so the child does not have to read a description and hunt for the block:

- **On the block** it is about (a ✦ at the end of the block, named "See what Ori noticed here"), when the finding points at one block, such as a condition that never held.
- **On the script**, a button above the blocks ("See what Ori noticed in this script"), when it is about the whole script, such as one that never started because nobody sends its message.
- **On the tab** of another of the character's scripts, when the finding is in a script that is not the open one, so a problem in script 2 is not hidden while script 1 is shown.

Tapping a mark opens the same sentence and points at the block, exactly like "Ori noticed something" below the stage; nothing is added to the program by it. A new run clears the marks. The marks are 44 px targets with a tooltip, and the tab's name carries the same words for a screen reader.
