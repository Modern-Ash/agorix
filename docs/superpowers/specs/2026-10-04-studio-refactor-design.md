# Studio refactor: shared core, two experiences, foundational charter

Status: draft for review. Date: 2026-10-04. Amends ADR 0006 (epic #242).

## Intent

Agorix Studio should be a rich, graphical, drag-and-drop IDE experience in the style of Kiro, with the agent present on every surface. It teaches children (about 8-14) to program with AI. Agorix Web should become a "Scratch native to AI". Both run on one shared, headless core. Agorix is shared free with foundations and educational institutions.

Success:

- the same program edited in Web and in Studio yields the same semantic hash;
- a new block, signal or agent mode appears in both surfaces without duplicate work;
- the learner always knows what they decided versus what AI only proposed;
- everything works with the agent disabled and without provider credentials.

Product invariants are unchanged: canonical program is the only authority, proposals stay pending until the learner decides, code stays visible, the runtime proves behavior, no PII, provider independence.

## Decisions

### D1. Shell: webview/plugin of VS Code

Studio ships as a VS Code extension (VSIX) with webview/custom-editor UI. It uses only public VS Code APIs so the same VSIX runs in VS Code forks (Kiro, Windsurf, VSCodium via Open VSX). A dedicated fork or standalone app is a later distribution option, not a different architecture: it only adds default layout, hidden chrome and a preinstalled extension.

### D2. Headless shared core

Existing packages stay as the core: `program-model`, `language-projection`, `runtime`, `stage`, `proposals`, `learning-decision-plane`, `block-editor` (model), `persistence`.

Two new platform-neutral packages (no DOM, no `vscode` imports):

| Package | Responsibility |
| --- | --- |
| `agent-workflow` | State machine of the Director/Auditor loop: intent -> plan -> tasks -> proposal -> predict -> run -> compare -> explain. Sessions, supervised and bounded-autonomy modes, visible proactive rules. Decisions still go through System 0, LAYA, `routeLearningRequirements`. |
| `interaction-core` | `DragIntent` (typed sources and targets), `AgentAnchor`, selection, keyboard parity, command and undo/redo, all as pure intents. |

UIs emit intents; the host turns them into canonical transactions (#191). A UI never mutates the program directly. A typed, versioned `studio-protocol` carries host <-> UI messages.

### D3. Two experiences on the core

| | Web: Scratch native to AI | Studio: Kiro-style |
| --- | --- | --- |
| Stages served | Explore, Connect, Translate (reaches Collaborate) | Collaborate, Create, Critique |
| Center | large touch blocks, stage, single screen | Mission Spec, canvas, code, diff, evidence |
| Agent | Agorix Agent character beside the stage; suggestions as draggable ghost blocks | structured agent panel: plan, tasks, proposals with diff, predictions; free text is secondary |
| Drag and drop | palette -> script, reorder, block -> agent | the same, plus evidence -> node, code <-> canvas |
| Density | minimal, playful | high, progressive by learner stage |

Every drag has a keyboard and button equivalent (`INPUT_PARITY_MATRIX`). No drop applies an AI proposal implicitly.

### D4. Kiro concepts translated for children

| Kiro | Agorix |
| --- | --- |
| Specs | **Mission Spec**: learner states intent, agent helps turn it into an editable plan and task list; each task is built, predicted, run and explained. |
| Steering | **Agent agreements**: visible settings for how much help the agent gives; drive `scaffold` and `solutionAllowance`. No hidden files. |
| Hooks | **Visible proactive rules** (`runtime-error`, `stalled`, `repeated-error`, `repeat-pattern`, `first-step`) as toggleable cards; silence is the default; decline caps and cooldowns remain. |
| Supervised/autopilot | Always supervised with diff. Autonomy exists only inside an approved task and still yields a reviewable `ProgramProposal`. |

### D5. Agent everywhere

Each surface declares `AgentAnchor`s: node, error, World entity, evidence row, palette item, mission goal. One `AgentLayer` renders ambient marks, ghost nodes, drop zones and prediction chips. A persistent ribbon shows the loop stage. Anti-over-assistance rules in `PEDAGOGY.md` apply unchanged.

### D6. Foundational charter and public benefit

New documents:

- `docs/FOUNDATIONS.md`: highest-ranking document. Philosophy (authorship, AI as a fallible collaborator, evidence over eloquence), lineage (Papert constructionism; Resnick's four Ps and creative spiral; Vygotsky/Bruner scaffolding; PRIMM; UNESCO AI Competency Framework for Students; OECD-EC AI Literacy Framework; AI4K12 big ideas), mapping of `LEARNING_PROGRESSION.md` to those frameworks, commitments and limits. The OECD-EC framework's final version must be verified before citing. Linked from README, `PRODUCT_INTENT.md` and `AGENTS.md`.
- `docs/product/PUBLIC_BENEFIT.md`: Apache-2.0 plus a free hosted service for verified educational institutions and foundations, funded by donations or grants, remote AI off by default. Requirements it imposes: near-zero AI cost (deterministic and local tiers first), offline and local-first, no mandatory account, low-end devices, i18n and accessibility as release conditions, teacher-facing exportable evidence without PII.

### D7. ADR 0007

- Amends ADR 0006: the agent panel is structured (plan, tasks, proposals, predictions); it is not a transcript chat.
- Updates `STUDIO_RELEASE_GATE.md`: removes "Studio does not expose Scratch-like block editing" and adds canvas and cross-surface rows.
- Amends the `PRODUCT_INTENT.md` non-goal "classroom administration": educator evidence and deployment tools are allowed, without PII, never classroom surveillance.
- Fixes the host/UI protocol contract and the package boundaries of D2.

## Refactor of the extension

`extensions/vscode/src/extension.ts` (1753 lines) splits into `host/`, `commands/` and `store/`. The eight TreeViews collapse into one Workbench custom editor (`.agorix`): canvas, code (real linked editor), World and evidence timeline. Developer and Inspector move to an opt-in engineering mode. Density follows the learner stage (start with canvas + World + code).

## Phases

1. Foundational docs and ADR 0007 (D6, D7).
2. Headless core with tests: `agent-workflow`, `interaction-core`, `studio-protocol`.
3. Web (blocks, drag and drop, Agent character) and Studio (Workbench, canvas, Mission Spec, agent panel) in parallel on the core.
4. Density levels and agent agreements.
5. Cross-surface release gate.

Existing epic #242 issues are reordered: anchors and canvas (#252-#255) precede agent depth (#256-#258). Already delivered agent work (#244-#247) is kept and rehomed into `agent-workflow` where applicable.

## Verification

- Semantic hash identical after identical edit sequences in Web and Studio.
- Reject leaves the project byte-for-byte unchanged; apply only on explicit accept.
- Core and both surfaces build and test with no provider credentials and with the agent disabled.
- Every drag intent has a tested keyboard path.
- Canvas accessibility limits (`ACCESSIBILITY_LIMITATIONS`) documented and mitigated by keyboard paths and the code projection.
- Telemetry stays within the non-PII fields of `STUDIO_AGENT.md`.

## Out of scope

Standalone app or fork packaging, multiplayer, payments, classroom surveillance, provider-specific behavior.
