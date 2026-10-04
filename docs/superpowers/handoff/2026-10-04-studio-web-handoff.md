# Handoff: Agorix Studio and Web (2026-10-04)

For the next agent. Read this first, then `docs/FOUNDATIONS.md`, ADR 0006 and 0007, and the spec at `docs/superpowers/specs/2026-10-04-studio-refactor-design.md`.

## Goal

Studio is a rich, graphical, drag-and-drop IDE experience in the style of spec-driven tools (Kiro), with the agent present on every surface, to teach children (about 8-14) to program with AI. Web is a "Scratch native to AI". Both sit on one shared headless core. The product is shared free with foundations and educational institutions (Apache-2.0 plus a free hosted service for verified institutions; remote AI off by default).

North star: AI proposes. Child decides. Runtime proves. Child explains. Nothing happens under the rug.

## Decisions already made (do not reopen without the owner)

- Shell: VS Code webview or plugin; the same VSIX should run in VS Code forks (Open VSX). A fork or standalone app is a later distribution option.
- One shared core, two experiences. UIs emit intents; the host owns canonical mutation.
- Studio has one canvas: the Workbench. The separate canvas editor from #267 was not landed (it duplicated the Workbench). The inline interactive canvas inside the World Preview from #269 was not ported for the same reason.
- Agent panel is structured (plan, tasks, proposals, predictions), not a transcript chat (ADR 0007).
- Deterministic System-0 scaffolds first; no provider call in the Workbench yet.
- Hosting model B: Apache-2.0 plus a free hosted service for institutions, remote AI off by default (`docs/product/PUBLIC_BENEFIT.md`).
- The owner prefers economy of tokens: implement first, then compact tests (no red-first TDD), minimal narration.

## What is on `main` (verified)

| Area                                  | Where                                                                                                                                                         | Notes                                                 |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| Foundations, public benefit, ADR 0007 | `docs/FOUNDATIONS.md`, `docs/product/PUBLIC_BENEFIT.md`, `docs/architecture/adr/0007-*`                                                                       | OECD-EC edition is unverified in FOUNDATIONS          |
| Headless core                         | `packages/interaction-core`, `packages/agent-workflow`, `packages/studio-protocol`                                                                            | pure, no DOM or vscode                                |
| Shared UI                             | `packages/studio-ui`                                                                                                                                          | palette, canvas, agent column, ghost blocks, reducers |
| Studio host                           | `extensions/vscode/src/host/*` (`workbenchHost`, `agentHost`, `agentPort`, `workbenchPanel`, `worldPreviewPanel`), `store/session.ts`, `commands/register.ts` | `extension.ts` is still about 1200 lines              |
| Studio shell                          | `extensions/vscode/src/webview/framework.ts` (+ `worldPreview.ts`, `host.ts`)                                                                                 | icon-first views, validated webview messages          |
| Web                                   | `apps/web/src/ghostMarks.ts`, `AgentCompanion.tsx`, `PredictionChip.tsx`, `crossSurfaceParity.test.ts`                                                        | PR #274                                               |
| Plans                                 | `docs/superpowers/plans/` (A core, B workbench, D agent, C web)                                                                                               | all executed                                          |

Merged PRs: #270 (A), #271 (B), #272 (B2 split), #273 (D), #274 (C), #275 (stranded shell).

## In flight

- **New PR from branch `fix/mundo-agorix-canvas`** (this branch): supersedes #269. It ports what #269 had that was not duplicated: project-api auth routes (register, sign-in, sign-out), "Mundo Agorix" branding, auto-reveal of Mundo Agorix and the Companion on project open or create, and the home-directory fallback for the create-project save dialog. After it merges, close #269 with a pointer to it.

## Pending work, in suggested order

Each item lists where to start. All of it must keep the invariants in `AGENTS.md`.

### Studio agent and canvas (epic #242)

1. **Ambient presence, #250.** CodeLens, code actions, a status indicator and icon-first Companion views. Offers must come from System-0 or LAYA, never a provider; silence is the default. Reuse `StudioSignalAdapter` and the System-0 policy in `packages/learning-decision-plane` (`studio-signals`, `proactive`).
2. **Real behavior for the agent drop zones.** `askAgent` intents currently answer `agentUnavailable`. Wire Explain, Debug and Challenge to the deterministic companion turns (`createCompanionTurn` in `studioCore.ts`) through `agentHost`.
3. **Live synchronization, #255.** Canvas, code, World Preview and Execution Inspector selection and highlight must follow each other. Anchors exist in `interaction-core` (`AgentAnchorRef`).
4. **Proposals on the canvas, #256 to #258.** Per-node accept, reject and modify (the `modified` decision is ignored today), side-by-side alternatives with trade-offs judged by runtime evidence (#257), and node-anchored proactive hints (#258). Keyboard and screen-reader review path.
5. **#248 remainder.** One clarifying question for ambiguous intents (reuse the Web `createDeterministicIntentPlan` flow from `@agorix/tutor-contract` or equivalent) and a stale base-hash check on the intent.
6. **#249 remainder.** Alternatives with trade-offs, role-profile gating of Apply, and the open question of predicting before accepting. The shipped loop predicts after accept and before run.
7. **#253 remainder.** A base-hash staleness check on Workbench edits (the discarded canvas editor had one) and an Extension Host integration test for the Workbench path (`extensions/vscode/test/integration/index.cjs`).
8. **#254 remainder.** Show the reason for illegal placement; decide whether a VS Code toolbar form is still wanted.
9. **#251 evidence.** `AgentEvent`s are held in memory (`session.agentEvents`). Add a non-PII, local-first export and the educator-facing evidence design; never names, emails, free text or raw model output.
10. **Provider-backed proposals.** Swap `proposeFor` and the plan step for a provider-backed path behind `studioProvider.request` and `createStudioPipeline` (System 0, LAYA, route, budget). `ProgramProposal` stays the contract. Add the modify decision and a budget indicator.
11. **Mission Spec, agreements persistence and density levels** (spec D4). Agent agreements are in-memory per session; stage-based density is not implemented.
12. **Studio i18n.** `studio-ui` and the agent column are English only. Web has en and es; Studio needs the same.
13. **Custom editor for `.agorix`** (the spec's D1; the Workbench is a `WebviewPanel` by ruling).
14. **Release gate, #259.** Journeys, safety review, cost evidence, docs. Update `docs/product/STUDIO_RELEASE_GATE.md`; add Studio e2e if feasible.
15. **Canvas accessibility.** Close the gaps in `ACCESSIBILITY_LIMITATIONS` with keyboard paths and a screen-reader equivalent.
16. **Distribution.** Open VSX packaging and a fork-friendly default layout.

### Web

1. Migrate Web drag handlers to `interaction-core` intents (deferred by ruling; parity is covered by `crossSurfaceParity.test.ts`).
2. Pointer-based touch drag (known gap in `docs/product/INPUT_PARITY_MATRIX.md`).
3. Web agreements beyond the on/off toggle (help ceiling, supervised or bounded mode), the closed-choice "explain" step, and non-PII agent events, mirroring Studio.
4. Unify the Web intent dialogue with `agent-workflow` task planning where it makes sense.
5. Provider-backed Web proposals behind the server boundary.

### Foundations and policy

- Verify the final OECD-EC AI Literacy Framework edition and update `FOUNDATIONS.md` (it cites the May 2025 review draft and an unverified 2026 edition).
- Validate the stage mapping (PRIMM, UNESCO, OECD-EC) with educators.
- `PUBLIC_BENEFIT.md` open decisions: the verification process for institutions and foundations, and who funds hosting and the opt-in remote AI tier.
- Educator tooling boundary: design evidence export and deployment tools without PII; no surveillance.

### Housekeeping

- Close PR #269 after the replacement merges.
- Remove finished worktrees under `/home/faguero/dev-agora/.agorix-agora-worktrees/`: `studio-refactor-spec`, `studio-workbench-plan`, `studio-agent-plan`, `web-scratch-plan`, `land-stranded`, `mundo-canvas`. Leave the older `issue-*` ones, they belong to Agora AI-SDLC.
- Keep GitHub issues current: #244, #245 are closed; #252 closes with #275; #248, #249, #253, #254, #256 carry status comments; #242 has a status comment. Update them as work lands.
- The owner has an untracked `agorix-first-mission222.agorix` in the main checkout; leave it.

## Conventions and gotchas

- Work in a git worktree off `origin/main`, never on the owner's checkout (it may be on an unrelated branch). Do not merge stacked branches into each other: #265 and #267 were merged into a stacked branch after its base had already landed, and that is how work got stranded. Always target `main`.
- Do not self-merge; open a PR linked to the issue (`AGENTS.md`). Commits end with the `Co-Authored-By` trailer given by your harness.
- Run commands from the worktree root. In zsh, `git show $M:path` mangles the path (`:p` and `:e` modifiers); use `${M}:path`.
- Verify before claiming: `pnpm lint && pnpm format:check && pnpm test && pnpm build && pnpm security:check`. `pnpm install --frozen-lockfile` once per new worktree. Local Node is v20 and the repo asks for 22; it works but warns.
- `test:vsix` (packaged VSIX smoke) is not run locally; CI (`vscode-extension-smoke`) covers it. Web e2e runs locally with `pnpm --filter @agorix/web test:e2e` (Chromium is installed); the full suite takes about 80 seconds.
- Extension tests mock `vscode` in `extensions/vscode/src/extension.test.ts`. The World Preview panel is created on project open, so Workbench tests locate their panel with `workbenchPanel()` by title, not by index.
- Shared packages must not import `vscode` (`scripts/vscode-boundary.test.mjs` enforces it).
- Learner free text is bounded (140 chars), never stored or echoed; telemetry and events are non-PII by construction.
- Web drop slots are numbered before the dragged block is removed; moves are indexed after removal. Use `finalMoveIndex` (Web) or `dropPointFor` (`studio-ui`).
- Provider calls: `studioProvider.request` exists but nothing in the extension calls it yet; only `probe()` is used.

## Useful entry points

- Loop state machine: `packages/agent-workflow/src/loop.ts`; host: `extensions/vscode/src/host/agentHost.ts`; port: `agentPort.ts`.
- Protocol and parsers: `packages/studio-protocol/src/index.ts`.
- Drag and keyboard intents: `packages/interaction-core/src/*`.
- UI: `packages/studio-ui/src/AgentPanel.tsx`, `Canvas.tsx`, `agentUi.ts`.
- Decision plane: `packages/learning-decision-plane/src/studio-*.ts`.
- Release gate matrix: `docs/product/STUDIO_RELEASE_GATE.md`.
