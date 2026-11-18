# Studio visual workspace — #1694

Studio is an IDE for advanced learners. Its layout follows the editor-centered structure of Kiro: a compact tool area, a dominant working editor, and a persistent assistant dock. The content remains Agorix-specific: canonical blocks, deterministic stage and evidence, and Ori as a learning companion.

## Existing backlog aligned to IDE usability

| Existing issue      | What still has to be proven                                                                                                                                                              |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| #1694, #1640, #1645 | At a real 900 × 700 VSIX viewport, a learner can see and use the program, stage, Run and Ori without scrolling; the palette remains discoverable and does not obstruct navigation.       |
| #1650, #1652        | Visual blocks and typed inputs let an advanced learner build nested logic through mouse and keyboard, with canonical edits and a complete insertion path for every visible palette item. |
| #1651, #1649        | The stage and creative assets remain recognizable, editable and persistent across Studio and Web.                                                                                        |
| #1653               | Installed-VSIX screenshots, cross-surface tests and learner/educator review establish visual comprehension before visual readiness is claimed.                                           |

These are the existing work items for this goal. Implementation slices link back to them; a passing semantic test alone does not close a visual-usability acceptance criterion.

## Layout and behavior

| Area       | Build                                                          | Scene                                                      | Evidence                   |
| ---------- | -------------------------------------------------------------- | ---------------------------------------------------------- | -------------------------- |
| Left tools | Visual block palette and search; overlay at 900 px             | Collapsed to free drawing space                            | Available on demand        |
| Center     | Canonical block program beside a live stage                    | Runtime stage beside character, costume and backdrop tools | Runtime stage and evidence |
| Right dock | Ori                                                            | Ori                                                        | Ori                        |
| Code       | Opens the existing synchronized projection in a VS Code editor | Same                                                       | Same                       |

Tools and Ori can each be hidden from the header without discarding the current workbench state. Build also exposes a Blocks button beside the program title. At 900 × 700 the tool palette starts collapsed; Build puts the program and stage side by side with Ori visible. The palette opens over the stage while the program stays available as a drop target, then the stage returns when the palette closes. At 1440 × 900 the editor has room for the persistent tool rail when it is open. The center tabs switch views without creating a second program model. Below 700 px the Scene tools stack under the stage. All colors use VS Code theme tokens.

Ori's dock has a vertical resize handle on its left edge. Dragging it or using Left/Right, Home/End while it has focus adjusts the panel within bounds that reserve room for the central editor. Shrinking the window clamps a previously wider dock to those bounds. Double-clicking the handle restores the default width. Hiding and reopening Ori retains the chosen width for the current Workbench session; narrow stacked layouts do not show the handle.

![Ori dock resized in an installed VSIX at 900 × 700](./assets/studio-vsix-ori-resized-900.png)

Each actor-owned script has a visible header in Build. Its Delete script action requires a second explicit confirmation and removes the script from the canonical program and actor ownership in one project commit. The final project script cannot be removed, so the editor always retains a runnable entry point.

Visible lists appear as compact stage watchers beside variables. Each watcher shows the canonical list name, runtime item count and current runtime values. Hidden lists stay hidden; long lists scroll within a bounded stage area. The displayed values come from deterministic execution frames, including Step and Reset, and never from a separate editor copy.

The Scene editor now groups actors, costumes, backdrops and image creation into visible tabs. Counts show available objects, selected cards show the current actor or asset, and a shortcut in costume/backdrop galleries opens image creation with the matching type selected. Switching galleries preserves the drawing canvas and current form state.

Image creation leads with a 160 × 120 drawing canvas and a two-row toolbar that fits a 900 px viewport. The learner can choose brush or eraser, ink color and stroke size, undo up to 12 edits, clear, and save a validated local PNG. Import remains restricted to bounded PNG/WebP data. A drawing is submitted as an asset only after the learner chooses Save; the canonical program is never changed by pointer movement alone.

The costume and backdrop galleries also open an existing image in the same canvas. Save changes replaces its image and optional name under the same asset ID, including bundled catalog images; Cancel edit leaves the project untouched. Image changes require adult media approval before they are persisted. The primary edit actions remain visible above the canvas at 900 × 700.

## Review captures

These captures use a local synthetic host with a sample canonical program, two actors, assets and a runtime frame. They show layout at the target viewport sizes, not a full VSIX journey.

| View     | 900 × 700                                                      | 1440 × 900                                                       |
| -------- | -------------------------------------------------------------- | ---------------------------------------------------------------- |
| Build    | ![Build at 900](./assets/studio-workspace-build-900.png)       | ![Build at 1440](./assets/studio-workspace-build-1440.png)       |
| Scene    | ![Scene at 900](./assets/studio-workspace-scene-900.png)       | ![Scene at 1440](./assets/studio-workspace-scene-1440.png)       |
| Costumes | ![Costumes at 900](./assets/studio-workspace-costumes-900.png) | ![Costumes at 1440](./assets/studio-workspace-costumes-1440.png) |
| Drawing  | ![Drawing at 900](./assets/studio-workspace-drawing-900.png)   | ![Drawing at 1440](./assets/studio-workspace-drawing-1440.png)   |

## Packaged VSIX verification

The packaged VSIX was also opened in an isolated VS Code profile with a portable `.agorix` fixture containing two actors, costumes, a backdrop, a variable, nested control flow, and an actor-click event. These are captures of the actual extension webview, rather than the synthetic host above:

| 900 × 700                                                    | 1440 × 900                                                     |
| ------------------------------------------------------------ | -------------------------------------------------------------- |
| ![Installed VSIX at 900](./assets/studio-vsix-build-900.png) | ![Installed VSIX at 1440](./assets/studio-vsix-build-1440.png) |

The bundled gallery is also exercised in the installed VSIX: filter the character cards, create Mika from her costume, confirm her image on stage, and reopen the saved project in Web.

| 900 × 700                                                     | 1440 × 900                                                      |
| ------------------------------------------------------------- | --------------------------------------------------------------- |
| ![Gallery actor at 900](./assets/studio-vsix-gallery-900.png) | ![Gallery actor at 1440](./assets/studio-vsix-gallery-1440.png) |

The actor inspector shows the selected costume as artwork. Its expandable visual picker offers the validated costumes with a visible selection state. Choosing a different thumbnail persists the actor edit and updates the deterministic stage before Run.

| 900 × 700                                                             | 1440 × 900                                                              |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| ![Costume picker at 900](./assets/studio-vsix-costume-picker-900.png) | ![Costume picker at 1440](./assets/studio-vsix-costume-picker-1440.png) |

The Scene stage exposes its current backdrop as artwork and opens a thumbnail picker beside the live preview. Choosing a backdrop persists the project metadata and redraws the idle stage; the installed journey confirms the chosen backdrop after Web import.

The stage also offers **+ Character** beside the backdrop control. It opens the full visual costume gallery, clears stale filters and keeps the stage in view. The learner chooses a costume card to create the actor and its owned start script explicitly.

At 900 px the component palette is an explicit drawer. The category launcher and Show tools control open it; entering Scene or Evidence closes it, and returning to Build keeps it closed until the learner opens it again. Run and the stage remain reachable after a tab change, while the palette can still be opened for a drag or insertion and closes after insertion. At wider sizes the palette remains a docked tool area in Build.

| 900 × 700                                                               | 1440 × 900                                                                |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| ![Character entry at 900](./assets/studio-vsix-character-entry-900.png) | ![Character entry at 1440](./assets/studio-vsix-character-entry-1440.png) |

| 900 × 700                                                               | 1440 × 900                                                                |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| ![Backdrop picker at 900](./assets/studio-vsix-backdrop-picker-900.png) | ![Backdrop picker at 1440](./assets/studio-vsix-backdrop-picker-1440.png) |

The same installed-VSIX journey captures editing a saved costume at both target sizes:

| 900 × 700                                                         | 1440 × 900                                                          |
| ----------------------------------------------------------------- | ------------------------------------------------------------------- |
| ![Edit costume at 900](./assets/studio-vsix-edit-costume-900.png) | ![Edit costume at 1440](./assets/studio-vsix-edit-costume-1440.png) |

The runtime list watcher is visible in the installed VSIX at both sizes:

| 900 × 700                                                          | 1440 × 900                                                           |
| ------------------------------------------------------------------ | -------------------------------------------------------------------- |
| ![List watcher at 900](./assets/studio-vsix-list-watchers-900.png) | ![List watcher at 1440](./assets/studio-vsix-list-watchers-1440.png) |

The real-window check exposed three issues now fixed: the custom editor had scripts disabled, the webview CSP blocked catalog images, and the host message parser rejected advanced canonical blocks so Program appeared empty. The 900 px Build view keeps the program, stage and Ori visible together; the palette opens over the stage so it cannot block program drop targets. On initial command-line file opening, VS Code still selects its text editor; **Reopen Editor With → Agorix Workbench** opens the visual editor. The extension declares Agorix Workbench as the default custom editor in its manifest, but automatic selection on command-line opening remains unverified.

The installed-extension suite in `extensions/vscode/test/integration/index.cjs` now opens a project with two actors, two costumes, a backdrop, a visible variable and a condition containing a repeat. Against a packaged VSIX in a clean VS Code profile, it checks the code projection, deterministic execution frames and evidence, a read-only Ori explanation, a proposal diff, explicit rejection with unchanged project bytes, and explicit acceptance with the canonical project saved. The Inspector's flat tree now supports VS Code's reveal contract, which this run exposed.

The local run used VS Code 1.146 via `VSCODE_EXECUTABLE=/usr/share/code/code pnpm --filter agorix-studio test:vsix` and passed all 18 integration cases. This is host-level verification of the installed extension. The real-window captures verify rendering.

The visible `test:visual` journey installs the packaged VSIX into an isolated VS Code profile, checks the initial list watcher, selects the second actor, creates and explicitly deletes one actor-owned script, draws and saves a costume after explicit adult media approval, selects it, cancels one edit without changing the project, then edits the costume under the same ID after adult approval. It chooses a bundled sound directly on a visual block, drags another block into the canonical program, runs the project, opens Evidence, checks the updated runtime list values, and verifies the edited costume in the saved portable project. It then imports that exact file in the Web advanced editor, compares the canonical program, actors and assets, verifies both actors and the painted costume on the Web stage, runs the program and observes runtime evidence. A declined adult media export creates no download; an approved export retains the program and image. This journey exposed two dead ends: learner-owned scene edits were routed to the unavailable AI host, and saving a project opened the Code projection over the visual workbench. Both paths now remain in Studio.

## Follow-up within #1694

Web now preserves the exact canonical trigger on import, including legacy `onStart`, so opening a Studio project does not silently rewrite it to `greenFlag`. Both triggers continue to execute as the same event. Ori's proposals must continue through learner preview and explicit acceptance before canonical mutation.
