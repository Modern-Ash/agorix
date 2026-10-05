# Handoff: Studio "powerization" (2026-10-05)

For the next agent. Read this first, then `docs/superpowers/handoff/2026-10-04-studio-web-handoff.md` (decisions that still hold), epic **#242** on GitHub, and `docs/product/AGORIX_STUDIO.md`.

## Where the initiative lives

- **Source of truth:** epic **#242** and its children #243 to #259 on GitHub. Product docs: `docs/product/STUDIO_AGENT.md`, `STUDIO_RELEASE_GATE.md`, `AGORIX_STUDIO.md`.
- `docs/superpowers/specs|plans/` hold the per-sub-project spec and plan written for this work. They are working records, not the official backlog.
- The remainder list the owner pasted (live sync, canvas proposals, provider-backed proposals, evidence export, #248/#249 remainders, Workbench robustness, product) was split into six sub-projects.

## State of the work

After PR #280 was merged, follow-up work continued on `feat/studio-provider-intent-planning`. The working tree also has an unrelated untracked `agorix-first-mission222.agorix`; leave it.

| #   | Sub-project                                                                                                          | State   | Spec / plan (in `docs/superpowers/`)                           |
| --- | -------------------------------------------------------------------------------------------------------------------- | ------- | -------------------------------------------------------------- |
| 1   | Live sync (canvas, code, World Preview, Inspector)                                                                   | done    | `specs/2026-10-05-live-sync-design.md`                         |
| 5   | #248/#249 remainders + Workbench robustness                                                                          | done    | `specs/2026-10-05-agent-gating-workbench-robustness-design.md` |
| 2   | Canvas proposals: per-operation decisions, alternatives, evidence                                                    | done    | `specs/2026-10-05-canvas-proposals-design.md`                  |
| 3   | Provider-backed proposals + structured intent-plan adapter                                                           | done    | `specs/2026-10-05-provider-proposals-design.md`                |
| 4   | Evidence export for educators (local-first, no PII)                                                                  | done    | none yet                                                       |
| 6   | Product: i18n, density, Mission Spec editing, custom `.agorix` editor, #259 release gate, full a11y, Open VSX (#239) | partial | none yet                                                       |

Latest provider-intent verification on this branch: `pnpm tsc --noEmit`, `pnpm lint`, `pnpm test` (1128 tests), `pnpm build`, `pnpm security:check` and `pnpm --filter agorix-studio package` green. Test runs that include `studioProvider.test.ts` were run outside the sandbox because the provider tests open a loopback server.

## Issue mapping (what to tell GitHub)

- #255 live sync: implemented. Compare with its acceptance criteria before closing.
- #256 / #257: implemented. The unit is the **operation**, not the node; first-step offers two alternatives, repeat-pattern one, a provider proposal adds the built-in one as an alternative.
- #258 proactive presence on the canvas: implemented. Ambient offers now publish a small canvas hint, anchored to the canonical node when available, and clear on accept/decline/stale/silence.
- #248: implemented in code. Workbench planning routes through the provider-neutral `@agorix/tutor-contract` intent-plan contract; when AI is configured it calls the validated `/intent-plan` provider boundary, rejects stale/invalid output and falls back to the deterministic local planner. UI still maps to fixed task cards and never echoes learner free text.
- #249: gating done (`requirePredictionBeforeAccept`); the independent pedagogy review it requires is pending.
- #246 / #247: the pipeline is wired for proposals only; the ambient controller still uses its own LAYA path, not `createStudioPipeline`.
- #251 evidence export: implemented locally with JSON + Markdown summary, counts only, no PII/free text/raw output.
- #259 release gate: strengthened with issue-specific rows for intent planning, ambient presence and educator evidence export, plus package asset checks.
- #239 distribution: packaged VSIX smoke now passes locally; Open VSX publication is wired as a manual workflow using `OVSX_PAT`.
- Sub-project 6 density: Workbench now has a manual `agorixStudio.workbench.density` setting (`comfortable`/`compact`). Stage-based density changes are still not implemented.
- Sub-project 6 i18n: Workbench HTML and Agent chrome now read project locale metadata and render fixed en/es copy, including deterministic task titles. Dynamic proposal/provider text remains source text. Fuller command/view i18n is still pending.
- Suggested publish step (needs the owner's OK): push the branch, open one PR, link #255/#256/#257 as closing and #246/#248/#249 as partial, comment per issue.

## Architecture added (where to look)

- `extensions/vscode/src/sync/syncHub.ts`: single host state (selected, executing, failed canonical node ids). Producers: Workbench host, `codeSync.ts`, World Preview, Inspector, execution (`didRunExecution` in `studioRuntime.ts`). Consumers re-render from the hub. `sync` protocol message carries block ids; the Workbench host maps canonical to block ids.
- `packages/proposals/src/selection.ts`: `selectProposalOperations`, `resolveOperationTargets`, `operationEditable`. "Apply selected" derives a revalidated proposal and commits once through `commitProgram`.
- `extensions/vscode/src/host/agentPort.ts` / `agentHost.ts`: `proposeFor` is async; `offered` holds the primary and alternatives; evidence is measured with `evidenceForProgram` (runtime only). `agentHost` guards stale and in-flight suggestions with an `epoch`. `planIntent` is optional and uses the provider-neutral intent-plan contract; `AgentPort` can ask a provider for `/intent-plan`, rechecks program hash on return, and falls back to deterministic planning when unavailable or stale.
- `extensions/vscode/src/commands/evidence.ts`: local educator evidence export. It asks for confirmation, writes JSON plus sibling Markdown, and only exports bounded counts/settings/runtime outcome.
- `extensions/vscode/test/integration/vsix.cjs`: packaged-extension smoke. It removes duplicate VS Code CLI profile flags before install/list, tolerates CLI versions that install correctly but return an empty `--list-extensions`, then runs the real Extension Host suite against the installed VSIX.
- `packages/studio-ui/src/Workbench.tsx` + `extensions/vscode/src/host/workbenchHtml.ts`: Workbench density is host-controlled through `data-density`, with compact CSS in `styles.ts`.
- `packages/studio-ui/src/i18n.ts` + Workbench/webview host wiring: fixed Studio UI copy supports English and Spanish from project locale metadata without changing canonical program semantics.
- `.github/workflows/open-vsx-publish.yml`: manual Open VSX publishing path. It packages the VSIX, then runs `ovsx publish` against the packaged file with `OVSX_PAT` from GitHub secrets.
- `extensions/vscode/src/studioProposalSource.ts` + `providerWiring.ts`: pipeline decision, provider call, double validation, fallback to built-in with a learner notice. Setting `agorixStudio.agent.proposalBudgetRequests`. `providerWiring.client()` also exposes the validated Studio provider client for Workbench intent planning.
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

1. Remaining Sub-project 6: fuller Studio command/view i18n, stage-based density levels, Mission Spec editing, custom `.agorix` editor and fuller a11y.
2. Independent code review of the branch and the #249 pedagogy review.
3. Push/open PR and update/close the mapped GitHub issues once the owner approves.
