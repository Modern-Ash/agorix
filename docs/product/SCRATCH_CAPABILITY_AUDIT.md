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
