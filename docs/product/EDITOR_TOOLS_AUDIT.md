# Editor tools audit: what exists, where a child reaches it (issue #1126)

Scope: the tools around the blocks (File/Edit, tutorials, debugging, stage controls, extensions) in
Escena libre (`KidsStudioScreen`) and the mission editor (`EditorScreen`). Checked in code and, for
the rows marked **E2E**, in a fresh session without flags (`apps/web/e2e/kids-studio-tools.spec.ts`).
It builds on `SCRATCH_CAPABILITY_AUDIT.md` and adds no second debugger: every row below uses the
one deterministic runtime and its trace.

| Tool                         | Escena libre                                                                                              | Mission editor                    | Status after this change                                                                                |
| ---------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| New / open                   | Crear (new scene), Mis proyectos (open)                                                                   | Map (mission), Mis proyectos      | Reachable. No change.                                                                                   |
| Save                         | Automatic on every change                                                                                 | Automatic                         | Reachable. No change.                                                                                   |
| Export                       | **Exportar escena** in the editor header (text only, `.agorix`) **E2E**                                   | Mis proyectos                     | Added to the Escena libre header. Media export stays a deliberate adult-gated flow in Mis proyectos.    |
| Import                       | Mis proyectos                                                                                             | Mis proyectos                     | Reachable; not duplicated in the editor on purpose.                                                     |
| Undo / Redo                  | Header buttons **E2E**                                                                                    | Header buttons, shortcuts (flag)  | Reachable. Shortcuts (flag `shortcuts`): Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, Ctrl/Cmd+D, Delete, `?` (#1110). |
| Play                         | Jugar **E2E**                                                                                             | Jugar                             | Reachable.                                                                                              |
| Step                         | Paso: advances one traced frame; the stage, watchers and highlighted block follow it **E2E**              | Step                              | Reachable. It is the debugger; nothing parallel was added.                                              |
| Stop / reset                 | Volver al inicio **E2E**; loops are bounded by the runtime (Ori explains a loop that does not end, #1152) | Reset                             | Reachable. No mid-run Stop: a run is bounded and finishes at once.                                      |
| Variable and list inspection | Watchers panel, value at the stepped frame                                                                | n/a (missions have no variables)  | Reachable.                                                                                              |
| Trace and evidence           | Blocks run, last condition result, "what really happened" coach                                           | Run status                        | Reachable.                                                                                              |
| Code view                    | Agorix Code, Python, Java, TypeScript                                                                     | Código tab                        | Reachable.                                                                                              |
| Tutorial / first steps       | **Primeros pasos** coach: add a block, Play, Step; **Ayuda** reopens it **E2E**                           | First-run coach on mission 1 only | Added to Escena libre. Non-blocking, once per device, behind the existing `tutorial` flag.              |
| Help                         | **Ayuda** button (reopens first steps)                                                                    | Ori                               | Added.                                                                                                  |
| Stage tools                  | Layer forward/backward, position, backdrop, art                                                           | n/a                               | Reachable.                                                                                              |
| Zoom / fullscreen stage      | none                                                                                                      | `zoom` flag in the mission editor | **Open.** Needs a design decision (touch layout, #1110).                                                |
| Context menu, duplicate      | Block menu (right click, long press, Shift+F10) and a duplicate button                                    | Flags `contextMenu`, `duplicate`  | Added to Escena libre (#1110).                                                                          |
| Extensions (Pen, Music)      | Palette categories while the adult keeps the pack on                                                      | n/a                               | Reachable; respects the adult switch.                                                                   |
| Ori in tutorial and debug    | Idea, prediction, coach, loop help; proposals are previews the child accepts                              | Ori card and chat                 | Reachable. No silent edits.                                                                             |

## Decisions

- **Debugging stays on the runtime trace.** Step, watchers and the coach read the run's own frames.
  Ori's loop help (#1152) reads the same trace. No LLM narration is treated as truth.
- **Tutorials never block.** The coach follows what the child does and ends after the first Step.
- **Still open:** zoom of the block list (CSS zoom would break the studio's drag math).
