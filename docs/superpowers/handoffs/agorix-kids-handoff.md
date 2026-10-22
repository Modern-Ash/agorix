# Agorix Kids: handoff to the next agent

Written 2026-10-21 at the end of Kids 03. Read this first, then the epic #371.

## What this project is

The Claude Design prototype (`prototipo/handoff/`) **replaces the Web UI**, with **Ori as an active AI agent** (Codex or OpenCode by default, behind a fixed agent definition), for ages 6 to 8. The old capabilities (actors, looks, sounds, variables, events, code views) are parked for an **advanced level** later. Mora (11, uses Scratch) is the first tester. Decisions, anti-goals and constraints: `docs/superpowers/specs/2026-10-21-agorix-kids-design.md`. Issue list and order: epic **#371** (issues #372 to #389, "Kids 01" to "Kids 18"). Hard rules: never show "AI not connected" to a child; the AI only suggests moves/behaviours, goals and app things; AI proposes, the child decides, the runtime proves; no keys or model calls in the browser; the app works with no AI.

## Where things stand

| Item                                                           | State                                                                |
| -------------------------------------------------------------- | -------------------------------------------------------------------- |
| Design doc, prototype handoff (#370)                           | merged                                                               |
| Kids 01 domain: grid, 3 missions, wall outcome (#372, PR #390) | merged                                                               |
| Kids 02 shell at `/kids`, store, copy, fonts (#373, PR #391)   | merged                                                               |
| Kids 03 onboarding, world map, progress (#374, PR #392)        | PR open, CI to confirm, **not merged**                               |
| Production (https://agorix.modern-ash.com)                     | still the OLD UI, commit `dea2a61ac8ef`; `/kids` is not deployed yet |
| Next                                                           | Kids 12 (#383) then Kids 04 editor (#375); order in the epic         |

## What exists in code (reuse it)

- `packages/curriculum/src/kids.ts`: `KIDS_GRID` (6x4, 40px cells), `cellToWorld`/`worldToCell`, `kidsMoveSteps(n)`, `KIDS_MISSION_IDS`, `getKidsMission(id, locale)`, `createFreeWorldMission(cell, locale)`, `evaluateKidsRun({mission, result})` -> `{outcome: success|wall|passed|short, trail, final, heading, wallAt?}` computed from `result.trace` (no `collectObservations` needed). The runtime has no world edge; the edge is interpreted here. Parity tests: `kids.test.ts`.
- `apps/web/src/kids/`: `KidsApp.tsx` (screen router), `kidsState.ts` (pure reducer, no program state), `kidsProgress.ts` (profile and mission progress in localStorage `agorix.kids.progress.v1`; to be derived from per-mission stored projects when Kids 04/05 exist), `strings.ts` (122 prototype strings es+en, voseo), `useKidsText.ts`, `format.ts`, `speak.ts` (🔊 via speech synthesis), `worlds.ts` (world colours/glyphs), `screens/OnboardScreen.tsx`, `screens/MapScreen.tsx`, `kids.css`. Entry: `/kids` (lazy chunk in `main.tsx`); becomes the default route in Kids 15.
- Fonts come from `@fontsource/*` (bundled, same origin; the CSP forbids Google Fonts).
- Existing machinery to reuse: `program-model` (statements `move(steps)`, `turn(degrees)`, `repeat`), `runtime` (`runProgram`, `trace`), `block-editor` (adapter and history), `provider-runtime` + `tutor-api` (`/api/tutor/health|respond`), `learning-evidence`, `learning-decision-plane` (System-0 proactivity), `language-projection`/`code-generator`.

## How to work here

- Setup: Node 22, pnpm 9. If `pnpm` is not on PATH: `corepack enable --install-directory <some dir on PATH>`.
- Loop per issue: branch from `main`, **test first**, then `pnpm verify`, `pnpm format:check`, `pnpm exec tsc --noEmit`, build and Playwright (`pnpm --filter @agorix/web build` before e2e: the e2e server serves `dist`), PR linked to the issue. **Do not self-merge**; ask the product owner before merging and before deploying. After a merge, deploy with `pnpm deploy:web` (runs verify, health, smoke, automatic rollback). Runbook: `docs/deployment/MODERN_ASH_HOST.md`.
- The product owner prefers short answers in Spanish, one question at a time, decisions put to him with a recommendation. He has approved each PR merge and deploy with a plain "si"; keep asking each time.
- Do not use the Agora CLI cycle unless asked (it was used once for #340; `.agora/` has old validation errors that are not yours).

## Gotchas already paid for

- The preview server serves `apps/web/dist`: rebuild before running Playwright.
- A Playwright `page.route` mock is bypassed by the service worker: `test.use({ serviceWorkers: "block" })` in that spec.
- Accessible names must contain their visible text (axe `label-content-name-mismatch`). That made `getByRole("button", { name: "Move" })` ambiguous; use `exact: true`.
- `localStorage.clear()` in specs wipes `agorix.locale`; the legacy specs re-set it to `en`. The product opens in Spanish by default.
- axe runs on every Kids screen and fails on serious/critical (contrast included: white text needs `--kids-runtime-strong`, not the light teal).
- Controls must be 44px+ and not clipped at 390x844, 820x1180 and 1180x820 (`e2e/responsive.spec.ts`, `kids-map.spec.ts` show the pattern with `hasTouch: true`).
- `prototipo/` is excluded from lint, format and typecheck; it is a read-only reference. Its `port/kidsEngine.ts` is only a parity reference, not shipped.
- The prod smoke (`apps/web/e2e/prod`) must be updated whenever the default route changes (Kids 15).
- The first smoke test sometimes fails once right after a deploy (passes on retry); it was not diagnosed.

## What to do next (suggested)

1. Confirm CI on PR #392, ask the owner to merge it.
2. **Kids 12 (#383)** first: one hint-ladder scale (prototype levels onto `learning-evidence` 1 to 5), "Ver idea" locked until earlier levels, prediction policy (mandatory in kids missions is the builder's call, to confirm with the owner after Mora's playtest).
3. **Kids 04 (#375)**, the editor, the biggest piece: own touch editor over `program-model` with `block-editor` as adapter; run/step on the real runtime and per-node traces; cells via `kidsMoveSteps`; outcomes via `evaluateKidsRun`; prediction overlay; undo; code strip (Agorix Code, Python, TypeScript); Ori card placeholder. Persist each mission's program as its own stored project and derive `done` from it.
4. Then 05, 06, 07, 08 (deterministic Ori from `prototipo/handoff/port/kidsEngine.ts` `computeProposal`), then the AI (09, 10, 11), 15, 18.

## Open items for the product owner (not for you to do)

- Disable Cloudflare Web Analytics on the zone (#365): it injects a third-party beacon the CSP blocks.
- `~/modernash/notify-whatsapp.sh` holds a Twilio token in plain text: move it to environment variables and rotate it.
- A stale system-wide `cloudflared.service` crash-loops (the live tunnel is the user service); `sudo systemctl disable --now cloudflared`.
- Mora's playtest (#389) after Kids 01 to 11 are deployed.
