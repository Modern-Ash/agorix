# Unreleased

- Kids Escena libre: `mouseX`, `mouseY` and `mouseDown` now read the pointer captured on the stage. Position is bounded to the stage, passed only as a run input and never saved in the project or sent to Ori (#1132).

- Kids Escena libre: a bounded `forever` loop is available once per script, outside other loops, with one to three body blocks; the runtime ends at its step budget with explicit trace and learner-facing feedback (#1132).
- Kids Escena libre: bounded `wait until` checks canonical conditions against a virtual clock for at most ten seconds, records timeout evidence, and offers the same conditions as `if` (#1132).
- Kids Escena libre: `Detener` now has three explicit scopes (script, character, scene), recorded in the deterministic runtime trace and preserved in project code projections (#1132).
- Kids Escena libre: Ori can explain and propose a closed `and` condition (Space key and stage edge), with a visible block preview, reject, accept or change to `or`; the child decides before the canonical program changes, and Undo/Redo and project reopening preserve the decision (#1131).
- Production Web at <https://agorix.modern-ash.com>: container image with a generated security-header set, deploy and rollback scripts with automatic rollback, `/version.json`, a read-only production smoke test as a deploy gate, and the runbook in `docs/deployment/MODERN_ASH_HOST.md`.
- Spanish by default with a remembered language choice; calm AI status ("Modo local" / "IA activa" / "IA no disponible ahora"), an adults-only explainer and a four-step loop in the AI panel.
- Optional same-origin tutor HTTP service (`/api/tutor/health`, `/api/tutor/respond`).
- Kids grown-ups panel split into four tabs (Resumen, Ajustes, Personalizar, Cuenta y privacidad); a shortcut from elsewhere opens the tab it is about, and the account link and group panels live under "Cuenta y privacidad" (#1109).
- Kids map: visible title with overall progress ("2 de 12 misiones"), concept chips that say their name, world tabs in four equal columns that never scroll sideways (also at 320 px), and a closable age-band notice that returns next visit (#1111).
- Kids free-scene editor: block category bar (Movimiento, Apariencia, Medios, Lógica, Lápiz, Música, Datos, Mis bloques) that jumps to each palette heading; Lápiz and Música show only while a grown-up keeps their pack on (#1110).
- Admin "Centro de IA": grouped menu (Reglas, Agentes de Ori, Contenido y grupos, Monitoreo), chat counters and revision history in their own "Historial y monitoreo" section, and a sticky draft bar that names the unpublished sections and the revision Publicar will create. Gates, API and stored configuration are unchanged (#1112).
- Kids Crear: the two start modes now say what they are (Escena libre = several characters and every block; ¡Crear! = one explorer, few blocks, optional goal), and Escena libre opens with a "Para empezar" shelf (move, turn, sound) above the whole palette, which stays complete. Engine coverage guard (`kidsCreationCoverage`) and an exhaustive palette category catalog keep the scene in step with the engine (#1121).
- Kids Escena libre: a child can set a goal for the scene ("Nova toca a Luma", "Nova llega al borde"); each run is checked against the characters' positions and says whether it was reached. The goal is saved with the project and travels in the `.agorix` file (`sceneGoal`, validated, ids only, no free text) (#1121).
- Kids Escena libre: Ori suggests a scene goal ("¿Podés hacer que Nova toque a Mika?"). The idea is one of the closed goals the child could pick alone, chosen locally for this cast and program, with "Otra idea", "Elegir esta meta" and "Ahora no"; nothing is sent anywhere and accepting changes only the goal (#1121).

# Agorix 0.1.0

First public beta release of Agorix: an AI-native creative coding platform with a Scratch-familiar Web experience and a professional VS Code Studio surface over the same canonical project model.

## Highlights

- Scratch-familiar visual programming: palette, direct blocks, drag/drop, snap, nesting, reorder, duplicate, delete and inline editing.
- AI-native learning loop: contextual assistance, System-0/Laya decision routing, explicit ProgramProposal review and deterministic runtime evidence.
- Worlds, Run/Stop/Step, execution feedback, touch/tablet/keyboard accessibility and Undo/Redo.
- Portable versioned `.agorix` projects for anonymous continuation and Web/Studio interchange.
- Agorix Studio VS Code extension with Activity Bar navigation, code projections, World Preview, Execution Inspector, contextual Learning Companion and native proposal diff/review.
- Private accounts and durable projects with username/password authentication, secure sessions, authorization and optimistic revision conflicts.
- PostgreSQL-compatible persistence for hosted deployments and SQLite for self-hosted persistent-volume deployments.
- Open-source-first self-hosting documentation and Apache-2.0 licensing.

## Product surfaces

### Agorix Web

Visual-first, Scratch-familiar and tablet-friendly. Anonymous sessions are ephemeral; export `.agorix` to continue later, or sign in for durable projects.

### Agorix Studio

VS Code-native, code-first experience for advanced learners/developers. Uses the same Canonical Program, runtime, evidence and proposal semantics as Web.

## Persistence

Authenticated projects support durable server storage through provider-neutral repository contracts:

- PostgreSQL, including managed PostgreSQL deployments such as Supabase-compatible hosting.
- SQLite for suitable single-instance/self-hosted deployments with persistent storage.

## AI authority

AI suggestions are provisional. They do not mutate accepted code until the learner explicitly applies them. Deterministic runtime evidence remains the behavioral authority.

## License

Apache License 2.0.
