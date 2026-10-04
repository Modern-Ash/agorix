# Web: Scratch native to AI (Plan C) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The owner asked to economize tokens: implement first, then write the compact tests named in each task (no red-first steps).

**Goal:** Close the gap between today's Web app and "a Scratch native to AI": proposals appear as ghost blocks in the program, the Agorix Agent is a visible companion with learner-controlled agreements, a lightweight predict-before-run loop uses runtime evidence, and a cross-surface test proves Web and Studio edit the program identically.

**Architecture:** Web already has the Scratch grammar (categorized palette, drag and drop, nesting, keyboard parity), an intent dialogue, proactive offers, proposal cards and an AI-literacy prediction. This plan does not rewrite `App.tsx` (3392 lines); it adds small, testable modules next to it (`ghostMarks.ts`, `AgentCompanion.tsx`, `PredictionChip.tsx`) and wires them at named points. Shared logic comes from the headless core (`@agorix/agent-workflow`, `@agorix/interaction-core`).

**Tech Stack:** TypeScript, React 18, vitest, Playwright (CI), existing `@agorix/block-editor`, `@agorix/proposals`, `@agorix/runtime`.

**Spec:** `docs/superpowers/specs/2026-10-04-studio-refactor-design.md` (D3 Web column, D4, D5), `docs/FOUNDATIONS.md`, `docs/product/INTERACTION_MODEL.md`, `docs/product/INPUT_PARITY_MATRIX.md`, `docs/product/PEDAGOGY.md`, ADR 0007. Builds on Plans A, B and D (Plan D's PR may still be open; this plan does not depend on it).

## Global Constraints

- The canonical program is the only authority; ghost blocks and the companion never change it. Only the learner's Accept (existing `acceptDeterministicProposal`) does; Reject leaves the program and its hash unchanged.
- No gesture applies an AI proposal implicitly: ghost blocks are not draggable and a drop never accepts (`INTERACTION_MODEL.md`).
- Silence first: the companion is resting by default and speaks only when an existing System-0 offer or an explicit review is active; this plan adds no new unsolicited offers.
- Core learning works with the agent off; turning it off hides offers, the intent dialogue and the AI suggestion activity, and never blocks editing, Run, Step, hints or missions.
- Prediction is never required: clicking Run without answering is a valid, silent skip; comparison is against `touchingGoal(result.world)` from the real run, never against AI text.
- Presentation prefs stay outside the stored project and the semantic hash (`presentationPrefs.ts` contract).
- Every user-facing string exists in `en` and `es` (`assertCatalogCompleteness`).
- Every drag keeps its button/keyboard equivalent; touch targets stay >= 44px; no hover-only controls; honor `prefers-reduced-motion`.
- No PII in storage, events or logs; no provider or credential in the bundle.
- Code passes `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`, `pnpm security:check`.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A proposal's ghost marks must disappear after Accept, Reject, project switch and any manual edit; a ghost for a node that no longer exists is ignored.
- Rejecting a proposal twice still counts declines exactly as today (System-0 goes quiet at 2 for repeat).
- Turning the agent off mid-review clears the proposal and the companion bubble; turning it on does not resurrect old offers.
- A corrupt or missing `agentEnabled` pref falls back to `true`; storage that throws never breaks rendering.
- The prediction chip resets when the program changes and never lingers across runs; a run started with no answer shows no comparison.
- Step-through completion also records the observed result, not only Run.
- Reduced-motion users see no animation on the companion; screen-reader users get the offer text once, via a polite status region, not on every render.
- Web and Studio produce the same semantic hash for the same edit sequence, including a move to the slot next to the source.

## Rulings

- **No rewrite of the Web drag handlers.** They already use `@agorix/block-editor` through `editorModel.ts`. Task 1 proves parity by test; migrating handlers to `interaction-core` intents is deferred. Cost if wrong: a later mechanical refactor.
- **Hints stay available with the agent off.** They are the deterministic tutor ladder, not generative help; the toggle controls proactive offers, the intent dialogue and the AI suggestion activity.
- **Ghost blocks are inline previews, not a drag target.** Accept/Reject stay on the existing proposal card.
- **One prediction question** ("Will the character reach the goal?") in this slice, same as Studio.

---

## File structure

| Path                                          | Responsibility                                                         |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `apps/web/src/crossSurfaceParity.test.ts`     | Same edit matrix through Web and the shared core gives the same hash   |
| `apps/web/src/ghostMarks.ts`                  | Pure: proposal diff -> marks per statement path plus added-ghost texts |
| `apps/web/src/AgentCompanion.tsx`             | Companion character, mood and offer bubble                             |
| `apps/web/src/PredictionChip.tsx`             | Predict control and comparison line                                    |
| `apps/web/src/presentationPrefs.ts` (modify)  | `agentEnabled` pref                                                    |
| `apps/web/src/i18n.ts` (modify)               | en/es strings                                                          |
| `apps/web/src/App.tsx`, `App.css` (modify)    | wiring and styles                                                      |
| `apps/web/e2e/adoption-gate.spec.ts` (modify) | journey for ghost, agent toggle and prediction                         |

---

### Task 1: Cross-surface parity test

**Files:**

- Create: `apps/web/src/crossSurfaceParity.test.ts`
- Modify: `apps/web/package.json` (add `@agorix/interaction-core` and `@agorix/agent-workflow` as `workspace:*` dependencies)

**Interfaces:**

- Consumes: `createEditorModel`, `addBlockToWorkspaceAt`, `moveBlockInWorkspaceByPath`, `deleteBlockFromWorkspaceAt`, `createEditorModelFromProgram` (`./editorModel.js`); `intentToChange`, `keyboardIntent`, `resolveDrop` (`@agorix/interaction-core`); `applyWorkspaceChange`, `programToWorkspace` (`@agorix/block-editor`); `programSemanticHash` (`@agorix/proposals`).
- Produces: none (evidence for the release gate).

- [ ] **Step 1: Add dependencies and install**

Add the two workspace dependencies to `apps/web/package.json`, run `pnpm install`.

- [ ] **Step 2: Write the matrix test**

Build a helper `studioPath(program, intents)` that starts from `programToWorkspace(program).workspace`, converts each `Intent` with `intentToChange(intent, () => "block:p_N")` (incrementing id) and applies `applyWorkspaceChange`, returning the final `program`. Build a helper `webPath(program, ops)` that starts from `createEditorModelFromProgram(program)` and applies the equivalent editorModel function per op, returning `model.program`. For each case assert `programSemanticHash(web) === programSemanticHash(studio)`:

1. insert `motion_move` at the end of an empty script;
2. insert `motion_turn` at index 0 of a two-statement script;
3. insert `control_repeat` then insert a `motion_move` inside its body (container `repeatBody`, `statementPath: [i]`);
4. move index 0 to the last position (Studio: `moveBlock` with final index `n-1`; Web: the equivalent slot call);
5. move index 1 to index 0;
6. move a block to the slot immediately after itself (a no-op in both; assert equal hashes and equal to the input hash);
7. delete the middle block of three;
8. keyboard parity: `keyboardIntent("Alt+ArrowDown", ...)` on index 0 of three equals the Web "Down" button result (`moveBlockInWorkspaceByPath` to index 1).

If the Web move helpers index slots before removal and the core indexes after removal (Studio's `dropPointFor` translates), the test must call each side with its own convention for the same visual action; record the mapping in a comment at the top of the test. Any case that still differs is a real parity bug: stop, ledger a ruling with the failing case, fix the smaller side, and keep the test.

- [ ] **Step 3: Verify and commit**

Run: `pnpm prettier --write apps/web && pnpm --filter @agorix/web test && pnpm lint`
Expected: PASS.

```bash
git add apps/web pnpm-lock.yaml
git commit -m "test(web): prove Web and the shared core edit programs identically

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Ghost blocks for proposals

**Files:**

- Create: `apps/web/src/ghostMarks.ts`, `apps/web/src/ghostMarks.test.ts`
- Modify: `apps/web/src/App.tsx` (`ProgramBlockCard` props, the workspace list render near line 2733, and the proposal card block near line 3270), `apps/web/src/App.css`, `apps/web/src/i18n.ts`

**Interfaces:**

- Consumes: `ProposalReview` (`@agorix/proposals`); `BlockWorkspaceSnapshot`, `StatementPath` helpers `blockNodeIdForPath`, `statementListAtPath`, `canContainStatements`, `childContainerPathFor` (`./editorModel.js`).
- Produces:

```ts
export type GhostMarkKind = "changed" | "removed";
export interface GhostMarks {
  readonly byPath: ReadonlyMap<string, GhostMarkKind>; // key = path.join(".")
  readonly added: readonly string[]; // afterText of added entries
}
export function ghostMarksFor(
  review: ProposalReview | undefined,
  workspace: BlockWorkspaceSnapshot,
): GhostMarks;
```

- [ ] **Step 1: Implement `ghostMarks.ts`**

```ts
import type { BlockWorkspaceSnapshot } from "@agorix/block-editor";
import type { ProposalReview } from "@agorix/proposals";
import {
  blockNodeIdForPath,
  canContainStatements,
  childContainerPathFor,
  statementListAtPath,
  type StatementPath,
} from "./editorModel.js";

export type GhostMarkKind = "changed" | "removed";

export interface GhostMarks {
  readonly byPath: ReadonlyMap<string, GhostMarkKind>;
  readonly added: readonly string[];
}

const EMPTY: GhostMarks = { byPath: new Map(), added: [] };

function visit(
  workspace: BlockWorkspaceSnapshot,
  container: StatementPath,
  visitor: (path: StatementPath) => void,
  depth = 0,
): void {
  if (depth > 16) return;
  const list = statementListAtPath(workspace, container);
  list.forEach((block, index) => {
    const path = [...container, index];
    visitor(path);
    if (canContainStatements(block)) {
      visit(workspace, childContainerPathFor(path), visitor, depth + 1);
    }
  });
}

/** Marks existing blocks a proposal would change or remove and lists text of blocks it would add. */
export function ghostMarksFor(
  review: ProposalReview | undefined,
  workspace: BlockWorkspaceSnapshot,
): GhostMarks {
  if (review === undefined) return EMPTY;
  const kindByNode = new Map<string, GhostMarkKind>();
  const added: string[] = [];
  for (const entry of review.diff) {
    if (entry.kind === "added") {
      if (entry.afterText !== undefined) added.push(entry.afterText.slice(0, 200));
    } else if (entry.kind === "removed") {
      kindByNode.set(entry.nodeId, "removed");
    } else if (entry.kind === "changed") {
      kindByNode.set(entry.nodeId, "changed");
    }
  }
  const byPath = new Map<string, GhostMarkKind>();
  try {
    visit(workspace, [], (path) => {
      const kind = kindByNode.get(blockNodeIdForPath(workspace, path));
      if (kind !== undefined) byPath.set(path.join("."), kind);
    });
  } catch {
    return { byPath: new Map(), added };
  }
  return { byPath, added };
}
```

If `statementListAtPath`/`childContainerPathFor` have different signatures than assumed, adapt the helper to the actual exports of `editorModel.ts` (read lines 222-260 first) and keep the public `ghostMarksFor` contract unchanged.

- [ ] **Step 2: Wire into `App.tsx`**

Compute `const ghostMarks = useMemo(() => ghostMarksFor(proposalReview, model.workspace), [proposalReview, model.workspace]);`. Pass `ghost={ghostMarks.byPath.get(path.join("."))}` into each `ProgramBlockCard` render (near line 2733) and add the prop `ghost?: "changed" | "removed" | undefined` to the card's props type; the card root gets class `ghost-changed` or `ghost-removed` and `aria-description` (new i18n keys `ghostWouldChange`, `ghostWouldRemove`). After the last top-level block render each `ghostMarks.added` text as a non-draggable `<div className="program-block ghost-added" role="group" aria-label={t(locale, "ghostSuggested", { text })}>` with a `ProvenanceLabel kind="suggestion"`. Ghost rows have no drag handlers, no buttons and no tab stops. The existing proposal card stays the only place with Accept and Reject.

- [ ] **Step 3: Styles and i18n**

In `App.css` add `.ghost-changed`, `.ghost-removed` (dashed outline using the existing AI/provisional token, never the success color; `.ghost-removed` text line-through) and `.ghost-added`. Add `ghostWouldChange`, `ghostWouldRemove`, `ghostSuggested` ("Suggested: {text}") to both locales (es: "Esta sugerencia cambiaría este bloque", "Esta sugerencia quitaría este bloque", "Sugerido: {text}").

- [ ] **Step 4: Tests**

`ghostMarks.test.ts`: with the repeat proposal over a program of three identical `move` + `turn` pairs (use `createRepeatPatternProposal` and `createProposalReview`), `ghostMarksFor` returns at least one `removed` or `changed` path whose block id resolves in the workspace and `added` contains the repeat text; with `undefined` returns empty marks; with a review whose node ids do not exist returns empty `byPath` without throwing. `App.test.tsx` additions via `renderToStaticMarkup(<ProgramBlockCard ... ghost="changed" />)`: output contains `ghost-changed` and the description, and no `draggable="true"` on a ghost-added row (render a small fixture of the added ghost through an exported `GhostAddedBlock` component if the inline JSX is not testable; extract it to `ghostMarks.tsx` only if needed).

- [ ] **Step 5: Verify and commit**

Run: `pnpm prettier --write apps/web && pnpm --filter @agorix/web test && pnpm --filter @agorix/web build && pnpm lint`
Expected: PASS.

```bash
git add apps/web
git commit -m "feat(web): show proposals as ghost blocks in the program

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Agorix Agent companion and agreements

**Files:**

- Create: `apps/web/src/AgentCompanion.tsx`, `apps/web/src/agentCompanion.test.tsx`
- Modify: `apps/web/src/presentationPrefs.ts`, `apps/web/src/presentationPrefs.test.ts`, `apps/web/src/App.tsx` (near line 3185 and the offer computations near lines 1776-1810), `apps/web/src/App.css`, `apps/web/src/i18n.ts`

**Interfaces:**

- Consumes: existing `firstStepOffer`, `repeatOffer`, `proposalReview`, `t`, `Locale`.
- Produces:

```ts
export type CompanionMood = "resting" | "offering" | "reviewing";
export function AgentCompanion(props: {
  locale: Locale;
  mood: CompanionMood;
  message?: string; // already localized offer text
  enabled: boolean;
  onToggle(next: boolean): void;
}): JSX.Element;
export function companionMood(input: {
  enabled: boolean;
  hasOffer: boolean;
  reviewing: boolean;
}): CompanionMood;
```

and `PresentationPrefs.agentEnabled: boolean` (default `true`).

- [ ] **Step 1: Prefs**

In `presentationPrefs.ts` add `agentEnabled: boolean` to `PresentationPrefs` and `DEFAULT_PRESENTATION_PREFS` (`true`); in `loadPresentationPrefs` set `agentEnabled: typeof parsed.agentEnabled === "boolean" ? parsed.agentEnabled : true`; the returned object and `save` include it. Extend `presentationPrefs.test.ts`: missing key -> `true`, `"yes"` -> `true`, `false` round-trips, throwing storage -> defaults.

- [ ] **Step 2: Component**

`companionMood`: `!enabled` -> `"resting"`; `reviewing` -> `"reviewing"`; `hasOffer` -> `"offering"`; else `"resting"`. `AgentCompanion` renders a `<figure className="agent-companion" data-mood={mood}>` with the existing `/brand/agorix-agent-active.svg` as a decorative `<img alt="">`, a `<figcaption>` with the agent's name (new key `agentName`), the toggle as a real `<label><input type="checkbox" checked={enabled} onChange=... /> {t("agentHelps")}</label>` (>= 44px target via CSS), and, when `enabled && mood !== "resting" && message`, a `<p role="status" aria-live="polite" className="agent-bubble">{message}</p>`. When `!enabled`, show `t("agentOffNote")` once in the same status region instead.

- [ ] **Step 3: Wire into `App.tsx`**

Add state `agentEnabled` initialised from `loadPresentationPrefs().agentEnabled` and saved through the existing prefs save effect. Replace the static `<div className="ai-guide" aria-hidden="true"><img .../></div>` with `<AgentCompanion ... />`: `message` is `t(locale, "firstStepTitle")` or `t(locale, "repeatSuggestionTitle", { count })` for the active offer, or `proposalMessage` while reviewing. When `!agentEnabled`: force `firstStepOffer` and `repeatOffer` to `undefined`, do not render `IntentDialogue` or the "Try an AI suggestion" button, and clear `proposalReview`/`proposalMessage` in the toggle handler. Hints (`requestHint`) and everything else stay untouched. Turning the agent on does not set any offer; the existing System-0 decisions drive them.

- [ ] **Step 4: Styles and i18n**

CSS: `.agent-companion[data-mood="offering"] img` gentle one-shot nudge animation; `@media (prefers-reduced-motion: reduce)` disables it; `.agent-bubble` uses the provisional/AI tone, not the success tone; the checkbox row has `min-height: 44px`. i18n keys (en/es): `agentName` ("Agorix Agent"/"Agorix Agent"), `agentHelps` ("Agent helps"/"El agente ayuda"), `agentOffNote` ("The agent is off. You can still build, run and get hints."/"El agente está apagado. Aún puedes construir, ejecutar y pedir pistas.").

- [ ] **Step 5: Tests**

`agentCompanion.test.tsx`: `companionMood` truth table (disabled always resting; reviewing beats offer; offer; nothing); markup for `offering` contains the bubble text inside `role="status"`; for `resting` contains no bubble; with `enabled=false` contains `agentOffNote` and an unchecked checkbox; no `style=`; the figure has `data-mood`. App-level: a static render of `App` still contains the checkbox labelled "Agent helps".

- [ ] **Step 6: Verify and commit**

Run: `pnpm prettier --write apps/web && pnpm --filter @agorix/web test && pnpm --filter @agorix/web build && pnpm lint`
Expected: PASS.

```bash
git add apps/web
git commit -m "feat(web): Agorix Agent companion with a learner-controlled agent toggle

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Predict before Run

**Files:**

- Create: `apps/web/src/PredictionChip.tsx`, `apps/web/src/predictionChip.test.tsx`
- Modify: `apps/web/src/App.tsx` (state near line 1720, `runBlocks` near 2333, `stepBlocks` completion branch, the Run controls render), `apps/web/src/App.css`, `apps/web/src/i18n.ts`

**Interfaces:**

- Consumes: `comparePrediction`, `PredictionAnswer`, `PredictionResult` (`@agorix/agent-workflow`); `touchingGoal` (`@agorix/runtime`); `t`.
- Produces:

```ts
export function PredictionChip(props: {
  locale: Locale;
  answer: PredictionAnswer | undefined;
  onAnswer(answer: PredictionAnswer | undefined): void;
}): JSX.Element;
export function PredictionComparison(props: {
  locale: Locale;
  answer: PredictionAnswer | undefined;
  reachedGoal: boolean | undefined;
}): JSX.Element | null;
```

- [ ] **Step 1: Components**

`PredictionChip`: a `<fieldset className="prediction-chip">` with legend `t("predictQuestion")` and three real buttons Yes / No / Skip (`aria-pressed` on the chosen one; Skip sets `undefined`), each >= 44px. `PredictionComparison`: returns `null` unless both `answer` and `reachedGoal` are defined; otherwise `<p role="status" className="prediction-comparison">` with `t("predictionCompared", { predicted, observed })` using `comparePrediction` only to pick the neutral hint key `predictionLookCloser` when it is `"mismatched"` (no success or failure styling), plus the label "runtime fact" (existing provenance wording if present, else new key `runtimeFactLabel`).

- [ ] **Step 2: Wire into `App.tsx`**

Add `const [prediction, setPrediction] = useState<PredictionAnswer | undefined>()` and `const [observedGoal, setObservedGoal] = useState<boolean | undefined>()`. Render `<PredictionChip>` next to the Run controls only when `agentEnabled && statements.length > 0 && status !== "running"`. Render `<PredictionComparison>` below the World/status area when `status` is `complete` or `retry`. In `runBlocks`, at the start clear `observedGoal`; where the interval completes (the branch that sets `complete`/`retry`) call `setObservedGoal(touchingGoal(result.world))`. In `stepBlocks`, in the `nextIndex >= nextSteps.length - 1` branch do the same with its `result`. Reset `prediction` and `observedGoal` in `commitProjection` (program change) and wherever `setProposalReview(undefined)` resets happen for project switches (lines near 1956, 2004, 2311), and after a completed comparison keep the answer until the program changes so a re-run compares again. Run is never disabled by the chip.

- [ ] **Step 3: i18n and styles**

Keys (en/es): `predictQuestion` ("Will the character reach the goal?"/"¿El personaje llegará a la meta?"), `predictYes` ("Yes"/"Sí"), `predictNo` ("No"/"No"), `predictSkip` ("Skip"/"Omitir"), `predictionCompared` ("You predicted: {predicted}. The run showed: {observed}."/"Predijiste: {predicted}. La ejecución mostró: {observed}."), `predictionLookCloser` ("That is a good thing to look at."/"Eso vale la pena mirarlo."), `observedReached` ("it reached the goal"/"llegó a la meta"), `observedNotReached` ("it did not reach the goal"/"no llegó a la meta"), `runtimeFactLabel` ("runtime fact"/"hecho del runtime"). CSS: `.prediction-chip` compact, neutral colors, focus ring; `.prediction-comparison` neutral tone.

- [ ] **Step 4: Tests**

`predictionChip.test.tsx`: chip markup has three buttons with `aria-pressed` reflecting `answer`; comparison returns `null` for `answer === undefined` or `reachedGoal === undefined`; for `yes`/`true` it renders the observed text and not the look-closer hint; for `yes`/`false` it renders the hint; no `style=`. Add an `App.test.tsx` case that a static render with an empty program has no `prediction-chip`. Add a pure helper test that `touchingGoal` of a world after a program that reaches the goal is `true` (use the first mission starter plus the known solution from the existing adoption fixtures if present, else skip with a ledgered note).

- [ ] **Step 5: Verify and commit**

Run: `pnpm prettier --write apps/web && pnpm --filter @agorix/web test && pnpm --filter @agorix/web build && pnpm lint`
Expected: PASS.

```bash
git add apps/web
git commit -m "feat(web): optional predict-before-run compared against runtime evidence

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: E2E, docs and PR

**Files:**

- Modify: `apps/web/e2e/adoption-gate.spec.ts`, `docs/product/INTERACTION_MODEL.md`, `docs/product/STUDIO_RELEASE_GATE.md`, `docs/FOUNDATIONS.md` (Web paragraph only if it no longer matches)

- [ ] **Step 1: Playwright journey**

Add `journey 10: ghost proposal, agent toggle and prediction never move the hash` in the existing style (reuse that file's helpers for canonical hash and palette): empty program -> the first-step offer appears -> "Try it" shows a `.ghost-added` row and the canonical hash is unchanged -> Reject restores the same hash and removes the ghost -> toggle "Agent helps" off hides `ai-welcome` and the intent dialogue while palette insert and Run still work -> toggle on -> answer the prediction chip "Yes", Run, assert the comparison status mentions "runtime fact" and the hash after Run equals the hash before. Run it locally only if Playwright browsers are installed (`pnpm --filter @agorix/web test:e2e`); otherwise leave it to CI and say so in the PR.

- [ ] **Step 2: Docs**

`INTERACTION_MODEL.md`: add a section "Ghost blocks, companion and prediction (Web)" stating the three behaviors, that ghosts are never a drop target, and the agent-off behavior. `STUDIO_RELEASE_GATE.md`: add a row "Cross-surface edits" with shared contract `BlockWorkspaceSnapshot`, `interaction-core` intents and `semanticProjectHash`, evidence `apps/web/src/crossSurfaceParity.test.ts` and `extensions/vscode/src/host/workbenchHost.test.ts`, intentional difference "Different surfaces, identical semantics", status Green only after the parity test passes. Keep column order of the existing table.

- [ ] **Step 3: Full verification and PR**

Run: `pnpm prettier --write docs apps/web && pnpm lint && pnpm format:check && pnpm test && pnpm build && pnpm security:check`
Expected: PASS.

```bash
git add apps/web docs
git commit -m "docs(web): document ghost blocks, companion and prediction; add e2e journey

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin docs/web-scratch-ai-plan
gh pr create --base main --title "Web: ghost proposals, Agorix Agent companion and predict-before-run" --body "Implements Plan C (docs/superpowers/plans/2026-10-04-web-scratch-native-ai.md).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Do not self-merge.

---

## Self-review

- **Spec coverage:** D3 Web column: ghost suggestions as blocks (Task 2), Agent companion (Task 3), same drag grammar proven shared with Studio (Task 1); D4: agreements as a visible toggle (Task 3), predict-run-compare (Task 4); D5: silence-first presence (Task 3). Not covered by design: replacing Web drag handlers with `interaction-core`, touch-driven pointer drag, Mission Spec, density levels, provider-backed Web proposals, evidence export.
- **Placeholders:** none; where App.tsx internals must be read before editing (editorModel helper signatures, Run control markup) the task says exactly what to read and what contract to keep.
- **Type consistency:** `GhostMarks`, `CompanionMood`, `PredictionAnswer`, `PredictionResult` and the pref name `agentEnabled` are defined once and reused.
- **Review Focus pinned:** ghost lifecycle and unknown nodes (Task 2 tests plus resets), decline counting (unchanged code path, covered by existing tests), agent-off mid-review (Task 3), corrupt prefs (Task 3), prediction reset and Step completion (Task 4), reduced motion and polite status (Task 3 tests/CSS), cross-surface hash incl. adjacent-slot move (Task 1).
- **Known risks:** `editorModel` helper signatures are assumed from their names; Task 2 tells the implementer to read lines 222-260 first. Web's slot-index convention versus core's after-removal convention may differ; Task 1 is designed to surface that as a ledgered ruling, not hide it.
