# Agorix Studio release gate

Issue #214 is the release gate for Studio as a professional projection of Agorix.
The gate is intentionally source-controlled: Web and Studio may feel different,
but every row below must point to the same shared contract and automated
evidence.

## Capability parity matrix

| Capability             | Shared contract                                                                     | Web UX                                          | Studio UX                                                                               | Automated evidence                                                                                                                           | Intentional difference                                                            | Status |
| ---------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ------ |
| Projects               | `StoredProject`, `ProjectStore`, `semanticProjectHash`                              | Browser-local project state and import/export   | `Agorix Studio: Open Project`, Account Project commands, file-backed session            | `apps/web/e2e/smoke.spec.ts`, `extensions/vscode/src/crossSurfaceCompatibility.test.ts`, `extensions/vscode/src/extension.test.ts`           | Web starts in browser storage; Studio starts from explicit file or server project | Green  |
| Canonical program      | `ProjectProgram`, `validateProgram`, `semanticProjectSnapshot`                      | Blocks mutate accepted canonical state          | Text projections inspect accepted canonical state; proposals are the only mutation path | `packages/program-model/src/validate.test.ts`, `apps/web/e2e/adoption-gate.spec.ts`, `extensions/vscode/src/studioCore.test.ts`              | Studio does not expose Scratch-like block editing                                 | Green  |
| Languages              | `LanguageProjection`, `ProjectionResult`, canonical node mapping                    | Web projection selector and compare view        | `Open Current Projection`, `Switch Projection`, canonical range reveal                  | `apps/web/e2e/smoke.spec.ts`, `extensions/vscode/src/studioCore.test.ts`, `extensions/vscode/test/integration/index.cjs`                     | Studio uses editor language modes and read-only virtual documents                 | Green  |
| World                  | `MissionDefinition`, `WorldDefinition`, runtime observations, stage frames          | Immersive Web world panel                       | IDE webview World Preview beside code                                                   | `apps/web/e2e/smoke.spec.ts`, `packages/stage/src/index.test.ts`, `extensions/vscode/test/integration/index.cjs`                             | Studio preview is compact and debugger-oriented                                   | Green  |
| Run/Stop/Reset/Step    | `runProgram`, `RunResult`, `ExecutionStep`                                          | Web buttons drive the same runtime              | `Run`, `Step`, `Stop`, `Reset` commands and view title actions                          | `apps/web/e2e/smoke.spec.ts`, `extensions/vscode/src/extension.test.ts`, `extensions/vscode/test/integration/index.cjs`                      | Studio exposes single-step debugging directly                                     | Green  |
| Evidence               | `RuntimeObservation`, `LearnerTraceItem`, inspector report                          | Web evidence and transparent programming panels | Execution Inspector tree and Output report                                              | `apps/web/e2e/adoption-gate.spec.ts`, `extensions/vscode/src/studioCore.test.ts`, `extensions/vscode/test/integration/index.cjs`             | Studio uses IDE inspector density                                                 | Green  |
| AI suggestions         | `ProgramProposal`, deterministic proposal sources, Learning Decision Plane          | Web suggestion cards require learner action     | Suggest Repeat / Suggest First Step open VS Code diff review                            | `apps/web/e2e/adoption-gate.spec.ts`, `packages/proposals/src/index.test.ts`, `extensions/vscode/src/extension.test.ts`                      | Studio proposal review is diff-first                                              | Green  |
| Proposal review        | `createProposalReview`, `acceptProposal`, `rejectProposal`, semantic hash freshness | Web preview/apply/reject controls               | Native diff, Apply Proposal, Reject Proposal, affected-node reveal                      | `packages/proposals/src/index.test.ts`, `extensions/vscode/src/studioCore.test.ts`, `extensions/vscode/src/extension.test.ts`                | Studio uses VS Code diff tabs                                                     | Green  |
| Learning Companion     | `LearningCompanionRequest`, `LearningCompanionResponse`, safety validator           | Web companion panel and offline fallback        | Explain/Challenge/Debug/Reflect/Build commands with response history                    | `packages/tutor-contract/src/index.test.ts`, `packages/learning-decision-plane/src/index.test.ts`, `extensions/vscode/src/extension.test.ts` | Studio companion can ground answers in selected editor/runtime evidence           | Green  |
| Progress               | `ProjectMetadata.missionProgress`, `hintLevel`, mission evaluation                  | Web mission/progress UI                         | Missions and Progress tree views plus validation report                                 | `packages/curriculum/src/index.test.ts`, `extensions/vscode/src/studioCore.test.ts`                                                          | Studio favors concise progress rows over beginner cards                           | Green  |
| Undo/Redo              | Accepted canonical snapshots plus `ProgramProposal` audit events                    | Web editor history and explicit proposal apply  | `Undo Proposal`, `Redo Proposal` restore canonical project snapshots                    | `packages/block-editor/src/history.test.ts`, `extensions/vscode/src/extension.test.ts`                                                       | Studio Undo/Redo is currently proposal-scoped                                     | Green  |
| `.agorix`              | Portable project envelope, forbidden portable keys, semantic hash                   | Import/export file controls                     | Open `.agorix`, Export Portable `.agorix Project`                                       | `packages/persistence/src/portable.test.ts`, `apps/web/e2e/smoke.spec.ts`, `extensions/vscode/src/studioCore.test.ts`                        | Studio file persistence is explicit; Web anonymous persistence is browser-local   | Green  |
| Authenticated projects | Optional server project id/revision outside canonical state, SecretStorage token    | Web account project list/save when configured   | Sign In, Open Account Project, Save Account Project with expected revision              | `apps/web/src/projectStorage.ts`, `extensions/vscode/src/extension.test.ts`                                                                  | Studio uses VS Code SecretStorage and fail-closed conflict prompts                | Green  |
| Developer workflows    | Canonical validation report, VS Code Tasks, VS Code SCM                             | Web does not duplicate IDE workflows            | Validate Project, Run Agorix Checks, Open Source Control, Developer Context             | `extensions/vscode/src/studioCore.test.ts`, `extensions/vscode/src/extension.test.ts`, `extensions/vscode/test/integration/index.cjs`        | Studio reuses native VS Code task and SCM surfaces                                | Green  |

## Release journeys

| Journey                                                                             | Automated evidence                                                                                                         | Release expectation                                                                 | Status |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ------ |
| Open/import project -> choose projection -> Run/Step -> World + Inspector           | `extensions/vscode/test/integration/index.cjs` (`Open Project`, projection switch, World Preview, Execution Inspector)     | A developer can inspect Agorix code and runtime state without block editing         | Green  |
| Contextual AI help from evidence                                                    | `extensions/vscode/test/integration/index.cjs` (`Companion debug uses deterministic runtime facts`)                        | AI help remains evidence-grounded and read-only                                     | Green  |
| Proposal -> diff -> Reject unchanged                                                | `extensions/vscode/src/extension.test.ts`                                                                                  | Reject leaves the project byte-for-byte unchanged                                   | Green  |
| Proposal -> Apply -> Undo -> Redo                                                   | `extensions/vscode/src/extension.test.ts`                                                                                  | Apply is explicit and snapshot history is coherent                                  | Green  |
| Web export -> Studio import -> semantic hash                                        | `extensions/vscode/src/crossSurfaceCompatibility.test.ts`, `packages/persistence/src/portable.test.ts`                     | Web-created semantics survive Studio open                                           | Green  |
| Studio export -> Web import -> semantic hash                                        | `extensions/vscode/src/crossSurfaceCompatibility.test.ts`, `extensions/vscode/src/studioCore.test.ts`                      | Studio writes only shared portable project state                                    | Green  |
| Authenticated project Web edit -> Studio reopen and vice versa with revision checks | `extensions/vscode/src/extension.test.ts` remote conflict test plus `apps/web/src/projectStorage.ts`                       | Newer server revisions are never silently overwritten                               | Green  |
| AI unavailable -> core Studio works                                                 | `extensions/vscode/src/studioCore.test.ts`, `extensions/vscode/test/integration/index.cjs`                                 | Provider absence does not block project open, run, validation or deterministic help | Green  |
| Real VS Code packaged extension smoke                                               | `extensions/vscode/test/integration/index.cjs`, `extensions/vscode/test/integration/vsix.cjs`, CI `vscode-extension-smoke` | Development host and packaged VSIX activate and expose contributed commands         | Green  |

## Product acceptance notes

Human review with an advanced learner/developer should confirm:

- Studio feels native to VS Code: Activity Bar views, editor projections, diff,
  tasks, SCM and Output are recognizable IDE affordances.
- The learner does not need to manipulate Scratch-like blocks in Studio to use
  Agorix code, runtime evidence, AI help or proposals.
- The learner recognizes the same project, mission, runtime and companion
  concepts from Web.
- Intentional differences are explained as surface differences, not product
  divergence.

## Studio command surface covered by the gate

The parity matrix must stay aligned with the contributed Studio commands used by
automation and human acceptance:

- `agorixStudio.openProject`;
- `agorixStudio.openProjection`;
- `agorixStudio.switchProjection`;
- `agorixStudio.openWorldPreview`;
- `agorixStudio.run`;
- `agorixStudio.step`;
- `agorixStudio.reset`;
- `agorixStudio.stop`;
- `agorixStudio.showEvidence`;
- `agorixStudio.companionDebug`;
- `agorixStudio.suggestRepeat`;
- `agorixStudio.applyProposal`;
- `agorixStudio.rejectProposal`;
- `agorixStudio.undoProposal`;
- `agorixStudio.redoProposal`;
- `agorixStudio.exportAgorix`;
- `agorixStudio.openRemoteProject`;
- `agorixStudio.saveRemoteProject`;
- `agorixStudio.validateProject`;
- `agorixStudio.runChecks`;
- `agorixStudio.openScm`.

## Close gate for #204

#204 can close after this file is committed and the following remain green:

- `pnpm verify`;
- `pnpm --filter agorix-studio test`;
- `pnpm --filter agorix-studio test:integration`;
- `pnpm --filter agorix-studio package`;
- CI `browser-smoke`;
- CI `vscode-extension-smoke`.
