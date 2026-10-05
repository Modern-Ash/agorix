# Handoff: Studio "powerization" (2026-10-05)

For the next agent. Read this first, then `docs/superpowers/handoff/2026-10-04-studio-web-handoff.md` (decisions that still hold), epic **#242** on GitHub, and `docs/product/AGORIX_STUDIO.md`.

## Where the initiative lives

- **Source of truth:** epic **#242** and its children #243 to #259 on GitHub. Product docs: `docs/product/STUDIO_AGENT.md`, `STUDIO_RELEASE_GATE.md`, `AGORIX_STUDIO.md`.
- `docs/superpowers/specs|plans/` hold the per-sub-project spec and plan written for this work. They are working records, not the official backlog.
- The remainder list the owner pasted (live sync, canvas proposals, provider-backed proposals, evidence export, #248/#249 remainders, Workbench robustness, product) was split into six sub-projects.

## State of the work

Branch `feat/studio-agent-followups`, **27 commits ahead of origin, not pushed, no PR, no issue was commented or closed.** The working tree also has an unrelated untracked `agorix-first-mission222.agorix`; leave it.

| #   | Sub-project                                                                                                          | State                 | Spec / plan (in `docs/superpowers/`)                           |
| --- | -------------------------------------------------------------------------------------------------------------------- | --------------------- | -------------------------------------------------------------- |
| 1   | Live sync (canvas, code, World Preview, Inspector)                                                                   | done                  | `specs/2026-10-05-live-sync-design.md`                         |
| 5   | #248/#249 remainders + Workbench robustness                                                                          | done                  | `specs/2026-10-05-agent-gating-workbench-robustness-design.md` |
| 2   | Canvas proposals: per-operation decisions, alternatives, evidence                                                    | done                  | `specs/2026-10-05-canvas-proposals-design.md`                  |
| 3   | Provider-backed proposals                                                                                            | done (proposals only) | `specs/2026-10-05-provider-proposals-design.md`                |
| 4   | Evidence export for educators (local-first, no PII)                                                                  | **next**              | none yet                                                       |
| 6   | Product: i18n, density, Mission Spec editing, custom `.agorix` editor, #259 release gate, full a11y, Open VSX (#239) | not started           | none yet                                                       |

Verification at the last commit: `pnpm lint`, `pnpm -r typecheck`, `pnpm test` (1105 tests), `pnpm build` green; `pnpm --filter ./extensions/vscode run test:integration` runs a real VS Code (14/14 ok).

## Issue mapping (what to tell GitHub)

- #255 live sync: implemented. Compare with its acceptance criteria before closing.
- #256 / #257: implemented. The unit is the **operation**, not the node; first-step offers two alternatives, repeat-pattern one, a provider proposal adds the built-in one as an alternative.
- #258 proactive presence on the canvas: **not done.** The hints built here are anchored to a proposal; #258 asks for ambient hints that respect silence-first.
- #248: clarifying question and stale base hash done; **provider-backed plans not done.**
- #249: gating done (`requirePredictionBeforeAccept`); the independent pedagogy review it requires is pending.
- #246 / #247: the pipeline is wired for proposals only; the ambient controller still uses its own LAYA path, not `createStudioPipeline`.
- #251 evidence export, #239 distribution, #259 release gate: open.
- Suggested publish step (needs the owner's OK): push the branch, open one PR, link #255/#256/#257 as closing and #246/#248/#249 as partial, comment per issue.

## Architecture added (where to look)

- `extensions/vscode/src/sync/syncHub.ts`: single host state (selected, executing, failed canonical node ids). Producers: Workbench host, `codeSync.ts`, World Preview, Inspector, execution (`didRunExecution` in `studioRuntime.ts`). Consumers re-render from the hub. `sync` protocol message carries block ids; the Workbench host maps canonical to block ids.
- `packages/proposals/src/selection.ts`: `selectProposalOperations`, `resolveOperationTargets`, `operationEditable`. "Apply selected" derives a revalidated proposal and commits once through `commitProgram`.
- `extensions/vscode/src/host/agentPort.ts` / `agentHost.ts`: `proposeFor` is async; `offered` holds the primary and alternatives; evidence is measured with `evidenceForProgram` (runtime only). `agentHost` guards stale and in-flight suggestions with an `epoch`.
- `extensions/vscode/src/studioProposalSource.ts` + `providerWiring.ts`: pipeline decision, provider call, double validation, fallback to built-in with a learner notice. Setting `agorixStudio.agent.proposalBudgetRequests`.
- Protocol additions in `packages/studio-protocol`: `sync`, `clarify`/`answerClarification`, `selectionEvidence`, `chooseAlternative`, `previewSelection`, error codes `STALE_EDIT`, `STALE_PLAN`, `PREDICTION_REQUIRED`, error `reason`, proposal `origin`/`notice`.

## Gotchas

- Run commands from `agorix/` (repo root). Per-package `vitest` can fail on config resolution; use `pnpm test`.
- If `@agorix/agent-workflow` cannot be resolved in `studio-ui`, run `pnpm install --frozen-lockfile` (a workspace symlink was missing once).
- Prettier reformats after edits; run `pnpm exec prettier --write <paths>` before `pnpm lint`.
- `getConfiguration` in `extension.test.ts` returns `agentConfig[key]` when set, else the old fallback; reset in `beforeEach`.
- The Extension Host test cannot inspect webview content; webview behavior is covered by host and UI unit tests.
- No provider was exercised for real: provider tests use `createFakeProviderRuntime` and a fake fetch.

## Known gaps and deliberate decisions

- Provider config (budget, LAYA) is re-read on each request, not on a configuration event.
- The Companion "build" signal uses `selection-changed` because the signal kinds are a closed set.
- A partial selection of a grouped change (e.g. repeat without its removals) is allowed when the resulting program is valid; the live evidence preview is the guard, not a block.
- The owner prefers token economy; earlier work in this session followed red-green TDD, which is heavier than the owner's stated preference. Compact tests are fine.
- Domain packages must not import `vscode`; no learner free text in logs or telemetry.

## Next steps

1. Sub-project 4: local-first, non-PII evidence export for educators. Build on `AgentEvent`s (`packages/agent-workflow/src/events.ts`), `LEARNING_EVIDENCE.md` and `packages/learning-evidence`.
2. Provider-backed plans and cabling the pipeline into the ambient controller (#246/#248 remainders).
3. #258 ambient hints on the canvas.
4. Sub-project 6 and #259 release gate.
5. Independent code review of the branch and the #249 pedagogy review.
