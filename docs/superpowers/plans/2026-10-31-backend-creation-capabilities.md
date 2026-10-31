# Plan: creation capabilities driven by the engine packages (follow-up of #1121)

Status: proposal, not started. Parent epic #1119. Related #1110, #1123, #1124. No cloud, no server work.

## Goal

The engine packages (`program-model`, `block-editor`, `runtime`, `curriculum`, `studio-protocol`) already define and run everything a learner can create. The Kids UI decides separately what to show, with hand-written palettes. Make the engine the single source of what exists, and make every Kids creation path expose it by rule, not by a copied list.

## Evidence (SHA cc8224f8)

The engine `Statement` union has 48 kinds (move, goTo, glideTo, turn, point*, bounce, layers, effects, pen*, music*, say/think, show/hide, size, wait, costume/backdrop, sound/volume, broadcast, variables, lists, repeat, repeatUntil, if, callProcedure).

| Kids path                   | Component                              | Engine statements it references        |
| --------------------------- | -------------------------------------- | -------------------------------------- |
| Escena libre (Crear escena) | `KidsStudioScreen`, `kidsStudioModel`  | all 48                                 |
| ¡Crear! (free project)      | `EditorScreen` + `kidsCatalog` palette | about 5: move, turn, repeat, playSound |
| Mission                     | `EditorScreen` + `paletteFor()`        | same 5, staged                         |

So the capability exists in the engine and in Studio. The only gap is that the free project path re-lists a 5-block subset by hand. Mission scaffolding is deliberate and stays.

## Phases

### Phase 1, make coverage a test (no behaviour change)

- Add a contract test in `apps/web` that enumerates the engine `Statement` kinds and asserts each is either in the Studio palette or in an explicit `INTENTIONALLY_NOT_IN_PALETTE` list with a reason.
- Same check for expressions, triggers, extensions (`pen`, `music`) and effects.
- This is the guard that stops future drift (the #1110 / #1119 class of bug).

### Phase 2, one palette definition

- Extract the Studio palette description (kind, category, label, defaults) from `KidsStudioScreen` into a pure module next to `kidsStudioCategories.ts`, keyed by engine statement kind.
- Mission `paletteFor()` becomes a named subset of that module (`mission stage` view), not a second list.
- Free project uses the same module with the full set.
- No visual change for missions or Studio. Existing e2e (`kids-age-palette`, `kids-block-palette`, `kids-free-access`) must stay green.

### Phase 3, one creative space that grows with the child (decided)

- Merge the two Crear buttons into a single **Escena libre**. The free project becomes a scene with one character; adding more characters is the same screen, not another mode.
- The whole engine vocabulary is always reachable (nothing locked, per #1110), but the palette is **curated by use**: it opens with a small "Para empezar" shelf and widens as the child's own programs use new concepts (mastery stages already tracked for `paletteFor()`).
- **Ori as discovery guide:** when a goal needs a block the child has not met, Ori proposes it with the usual visible diff and accept/change/reject, never silent mutation. This turns the palette into the learning loop instead of a catalog.
- **Missions become quests inside the scene:** a mission loads its goal and the staged subset as a guided overlay on the same editor; finishing it keeps the project and its progress, so mapa and progression are preserved.
- Respect age band (code tabs only), flags (`extensionPen`, `extensionMusic`), adult settings and the existing safety guarantees exactly as Studio does.
- Migration: existing free projects (`#/libre/{id}`) open in the merged scene; old hashes redirect.

### Phase 4, runtime and projection parity

- For each statement exposed in the free editor, confirm block editor, runtime and code projections (`java-projection`, `python-projection`, `language-pack-lua`, `agorix-code`) handle it; add fixtures where a projection lacks one.
- Validate with `validateProgram` and the existing snapshot tests.

### Phase 5, evidence

- Fresh-session E2E per exposed capability, desktop/tablet/mobile (extends `kids-free-access.spec.ts`).
- Record results in the matrix of #1122 and the deploy SHA from #1123.

## Order

Phase 1 first, alone (cheap, shows the real gaps). Phase 2 as refactor-only PR. Phase 3 is the product change; split it: merge entry points first, then curated shelf, then Ori discovery, then missions-as-quests. Phases 4 and 5 ride with Phase 3.

## Risks

- `KidsStudioScreen` is about 4.5k lines; extract the palette data only, do not restructure the screen in the same PR.
- Mission pedagogy depends on the 5-block subset; keep it tested with the existing age-palette snapshots.
- Some engine statements may be deliberately hidden for young bands; the Phase 1 exclusion list makes that explicit.

## Out of scope

Cloud sync, accounts, server endpoints, Ori backend rollout (#1124), group mode (ADR 0010).

## Delivered in PR #1128 (phases 1 to 3, first slice)

- Phase 1: coverage guard for statements, expressions, triggers, effects and extensions.
- Phase 2: exhaustive `STUDIO_BLOCK_CATEGORY`. The palette JSX of `KidsStudioScreen` is not rendered from it yet: its 21 blocks carry their own controls and state, so rendering from data waits for the merged editor.
- Phase 3, first slice: both Crear modes explain themselves; Escena libre opens with a "Para empezar" shelf (`STUDIO_STARTER_BLOCKS`) over the whole palette.

Deliberately not done, and why: the free project (`#/libre/{id}`) is not removed yet. It carries tested behavior Studio lacks (optional goal verified by Ori, explorer in a world, 10+ e2e specs), so the real merge needs those moved into the scene first. Still open: widening the shelf by use, Ori as discovery guide, missions as quests, the `gap:` conditions (`<=`, `>=`, `and`, `or`, `not`).

## Step 2 of the merge: scene goals (this PR)

The free project's goal lives on a grid runtime (curriculum `verifyKidsFreeGoal`), which Studio does not use, so goals were rebuilt natively for the scene: `ProjectSceneGoal` (`touchActor`, `reachEdge`) in `@agorix/persistence` metadata and `.agorix` files, `kidsSceneGoal.ts` (checks run frames with the runtime's own touch and edge geometry), and a goal panel in Escena libre. A goal that is already true before any step does not count. Still open before `¡Crear!` can be retired: Ori proposing scene goals (the free project has `kidsGoalsRemote`), the explorer-in-a-world look, and moving existing `#/libre/{id}` projects into scenes.

## Step 3 of the merge: Ori proposes scene goals

`kidsSceneGoalProposal.ts` ranks the closed goal choices for the current cast and program (a meeting for a character that already moves, the edge when alone) and Ori offers them one at a time with accept, another idea or not now. It is local and deterministic, so it adds no AI or data surface. A remote Ori proposal for scenes (like `/api/tutor/goals` for the grid) would need a tutor-api contract and safety review and is not part of this step. Still open before `¡Crear!` can be retired: the explorer-in-a-world look and migrating `#/libre/{id}` projects.
