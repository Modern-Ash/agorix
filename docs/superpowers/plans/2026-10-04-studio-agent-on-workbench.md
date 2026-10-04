# Studio agent on the Workbench (Plan D) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. The owner asked to economize tokens: implement first, then write the compact tests named in each task (no red-first steps).

**Goal:** Put the Director/Auditor loop inside the Workbench: intent bar -> plan -> proposal shown as ghost blocks -> predict -> run -> compare -> explain, with visible agent agreements, using only the deterministic System-0 scaffolds that already exist (first step, repeat pattern). Covers issues #248, #249 and the ghost-node part of #256.

**Architecture:** `agent-workflow` gains pure helpers (plan selection, prediction, explanation, events). `studio-protocol` gains the learner/agent messages. A pure `agentHost` (injected `AgentPort`) drives the existing `agent-workflow` state machine and reuses the extension's proposal review/apply path. `studio-ui` gets an agent column (ribbon, intent bar, cards) and ghost marking on the canvas. No provider is called: a later plan swaps the deterministic `proposeFor` for a provider-backed one behind the same `ProgramProposal` contract.

**Tech Stack:** TypeScript, React 18, vitest, existing `@agorix/proposals`, `@agorix/runtime`, `@agorix/block-editor`.

**Spec:** `docs/superpowers/specs/2026-10-04-studio-refactor-design.md` (D2, D4, D5), `docs/product/STUDIO_AGENT.md`, `docs/product/PEDAGOGY.md`, ADR 0007. Builds on Plans A and B (merged).

## Global Constraints

- Silence is the default: the agent never speaks unless the learner states an intent or turns on bounded mode; this plan adds no unsolicited offers.
- Every AI-originated change is a proposal: the host applies one only after `decideProposal` with `accepted` for the pending proposal id, in stage `proposal`, and never when stale; rejecting leaves the project file byte-for-byte unchanged.
- Runtime evidence, not the agent, proves behavior: the prediction is compared with `touchingGoal(result.world)` from a real run; `completed` in the workflow comes only from that.
- Prediction and explanation can always be skipped; skipping never blocks running or completion (`PEDAGOGY.md`: reflection never blocks).
- Learner free text is at most 140 characters, control characters stripped, and is never stored, echoed, logged or sent anywhere in this plan; it only selects among deterministic tasks.
- No PII in events: `AgentEvent` carries type, task id and scaffold level only.
- With `aiEnabled: false` every agent message answers `agentUnavailable`; the canvas keeps working.
- AI artifacts use the provisional treatment (dashed, labelled "Suggestion"), never success styling.
- Shared packages import no `vscode`; only `extensions/vscode` does.
- Code passes `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A proposal that went stale (the learner edited the program after it was shown) must never be applied; the learner sees a calm message and the file is unchanged.
- No message sequence applies a proposal without a matching, pending, learner-sent `accepted` decision (try: decide with a wrong id, decide at the wrong stage, decide twice).
- A manual edit during `proposal`, `predict`, `run` or `compare` resets the loop instead of comparing against stale evidence.
- Intent text with URLs, emails, paths, control characters or more than 140 characters is bounded and never reaches state or output.
- Rejecting a proposal twice and re-requesting does not wedge the workflow.
- Bounded mode requests a proposal automatically after the plan is accepted but still waits for the learner's decision.
- Turning the agent off mid-loop clears the loop and hides agent cards; turning it on starts clean.
- Ghost marks for ids that no longer exist on the canvas are ignored without error.

## Rulings

- **Deterministic first.** `askAgent`/provider-backed generation stays out; `proposeFor` uses `suggestFirstStep`/`suggestRepeat`. Cost if wrong: the provider plan replaces one function.
- **Accept/Reject only.** `modified` decisions are ignored for now; modify-then-commit lands with the provider plan. The invariant allows accept, reject or modify; offering two is not a violation.
- **External edits reset the loop.** Simpler and safer than partial invalidation.
- **Ghost rows for added statements render at the end of script 0.** Diffs do not carry the target script; the starter missions use one script.

---

## File structure

| Path                                                                       | Responsibility                                             |
| -------------------------------------------------------------------------- | ---------------------------------------------------------- |
| `packages/agent-workflow/src/plan.ts`                                      | `AgentTaskId`, `AgentTask`, `normalizeIntent`, `planTasks` |
| `packages/agent-workflow/src/predict.ts`                                   | prediction question and comparison                         |
| `packages/agent-workflow/src/explain.ts`                                   | concepts and explanation check                             |
| `packages/agent-workflow/src/events.ts`                                    | non-PII `AgentEvent`                                       |
| `packages/studio-protocol/src/index.ts` (modify)                           | new UI/host messages and parsers                           |
| `extensions/vscode/src/host/agentHost.ts`                                  | pure agent host and `AgentPort`                            |
| `extensions/vscode/src/host/agentPort.ts`                                  | vscode-free adapter over session/proposals/runtime         |
| `extensions/vscode/src/host/workbenchPanel.ts` (modify)                    | compose agent host with workbench host                     |
| `extensions/vscode/src/store/session.ts` (modify)                          | `agentEvents`                                              |
| `packages/studio-ui/src/agentUi.ts`                                        | pure reducer of host messages                              |
| `packages/studio-ui/src/AgentPanel.tsx`                                    | ribbon, intent bar, cards, agreements                      |
| `packages/studio-ui/src/Canvas.tsx`, `Workbench.tsx`, `styles.ts` (modify) | ghost marks, agent column, styles                          |

---

### Task 1: `agent-workflow` helpers

**Files:**

- Create: `packages/agent-workflow/src/plan.ts`, `predict.ts`, `explain.ts`, `events.ts`, `src/helpers.test.ts`
- Modify: `packages/agent-workflow/src/index.ts`

**Interfaces:**

- Consumes: `AssistanceLevel` from `./assistance.js`.
- Produces:
  - `AGENT_TASK_IDS`, `type AgentTaskId = "first-step" | "repeat-pattern"`, `interface AgentTask { id: AgentTaskId; title: string }`, `MAX_INTENT_LENGTH = 140`, `normalizeIntent(text: unknown): string | undefined`, `planTasks(intent: string, available: readonly AgentTaskId[]): AgentTask[]`
  - `type PredictionAnswer = "yes" | "no"`, `type PredictionResult = "matched" | "mismatched" | "skipped"`, `comparePrediction(answer: PredictionAnswer | undefined, reachedGoal: boolean): PredictionResult`
  - `CONCEPT_IDS = ["sequence","repetition","condition","event"]`, `type ConceptId`, `relevantConcept(task: AgentTaskId): ConceptId`, `checkExplanation(task: AgentTaskId, chosen: ConceptId): "relevant" | "other"`
  - `type AgentEventType` and `interface AgentEvent { type: AgentEventType; taskId: AgentTaskId; scaffoldLevel: AssistanceLevel }`, `MAX_AGENT_EVENTS = 200`

- [ ] **Step 1: Implement**

`plan.ts`:

```ts
export const AGENT_TASK_IDS = ["first-step", "repeat-pattern"] as const;
export type AgentTaskId = (typeof AGENT_TASK_IDS)[number];

export interface AgentTask {
  readonly id: AgentTaskId;
  readonly title: string;
}

export const MAX_INTENT_LENGTH = 140;

const TITLES: Record<AgentTaskId, string> = {
  "first-step": "Try one visible movement step",
  "repeat-pattern": "Write the repeated steps once with repeat",
};

const KEYWORDS: Record<AgentTaskId, RegExp> = {
  "first-step": /\b(move|moves|walk|go|step|forward|mover|avanzar|caminar|paso|adelante)\b/,
  "repeat-pattern": /\b(repeat|repeats|loop|times|again|repetir|repite|veces|bucle)\b/,
};

/** Bounds free text. The result selects tasks only; callers must not store or echo it. */
export function normalizeIntent(text: unknown): string | undefined {
  if (typeof text !== "string") {
    return undefined;
  }
  const cleaned = text
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (cleaned.length === 0 || cleaned.length > MAX_INTENT_LENGTH) {
    return undefined;
  }
  return cleaned;
}

function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

/** Keyword hits among available tasks; with no hit, offer what the agent can do (max all available). */
export function planTasks(intent: string, available: readonly AgentTaskId[]): AgentTask[] {
  const folded = fold(intent);
  const hits = available.filter((id) => KEYWORDS[id].test(folded));
  const chosen = hits.length > 0 ? hits : available;
  return chosen.map((id) => ({ id, title: TITLES[id] }));
}
```

`predict.ts`:

```ts
export type PredictionAnswer = "yes" | "no";
export type PredictionResult = "matched" | "mismatched" | "skipped";

/** The only question in this slice: will the character reach the goal. Compared with a real run. */
export function comparePrediction(
  answer: PredictionAnswer | undefined,
  reachedGoal: boolean,
): PredictionResult {
  if (answer === undefined) {
    return "skipped";
  }
  return (answer === "yes") === reachedGoal ? "matched" : "mismatched";
}
```

`explain.ts`:

```ts
import type { AgentTaskId } from "./plan.js";

export const CONCEPT_IDS = ["sequence", "repetition", "condition", "event"] as const;
export type ConceptId = (typeof CONCEPT_IDS)[number];

export function relevantConcept(task: AgentTaskId): ConceptId {
  return task === "repeat-pattern" ? "repetition" : "sequence";
}

/** Feedback only; explaining never blocks progress. */
export function checkExplanation(task: AgentTaskId, chosen: ConceptId): "relevant" | "other" {
  return chosen === relevantConcept(task) ? "relevant" : "other";
}
```

`events.ts`:

```ts
import type { AssistanceLevel } from "./assistance.js";
import type { AgentTaskId } from "./plan.js";

export type AgentEventType =
  | "proposalRequested"
  | "proposalAccepted"
  | "proposalRejected"
  | "predictionMatched"
  | "predictionMismatched"
  | "predictionSkipped"
  | "explainCompleted"
  | "explainSkipped";

/** Non-PII by construction: no text, ids of people, paths or model output. */
export interface AgentEvent {
  readonly type: AgentEventType;
  readonly taskId: AgentTaskId;
  readonly scaffoldLevel: AssistanceLevel;
}

export const MAX_AGENT_EVENTS = 200;
```

Append to `index.ts`:

```ts
export type { AgentTask, AgentTaskId } from "./plan.js";
export { AGENT_TASK_IDS, MAX_INTENT_LENGTH, normalizeIntent, planTasks } from "./plan.js";
export type { PredictionAnswer, PredictionResult } from "./predict.js";
export { comparePrediction } from "./predict.js";
export type { ConceptId } from "./explain.js";
export { CONCEPT_IDS, checkExplanation, relevantConcept } from "./explain.js";
export type { AgentEvent, AgentEventType } from "./events.js";
export { MAX_AGENT_EVENTS } from "./events.js";
```

- [ ] **Step 2: Tests (`src/helpers.test.ts`)**

Cover: `normalizeIntent` returns `undefined` for non-strings, empty, and 141 chars; strips control characters (`"move\u0000 now"` -> `"move now"`); `planTasks("repite 3 veces", ["first-step","repeat-pattern"])` -> only repeat; `planTasks("hola", [...both])` -> both; `planTasks("move", [])` -> `[]`; accents (`"avanzár"` hits first-step after folding); `comparePrediction` for `yes/true` matched, `no/true` mismatched, `undefined` skipped; `checkExplanation("repeat-pattern","repetition")` relevant and `("first-step","condition")` other.

- [ ] **Step 3: Verify and commit**

Run: `pnpm prettier --write packages/agent-workflow && pnpm --filter @agorix/agent-workflow test && pnpm --filter @agorix/agent-workflow build && pnpm lint`
Expected: PASS.

```bash
git add packages/agent-workflow
git commit -m "feat(agent-workflow): intent planning, prediction, explanation and event helpers

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: Protocol messages for the agent loop

**Files:**

- Modify: `packages/studio-protocol/src/index.ts`, `packages/studio-protocol/src/index.test.ts`

**Interfaces:**

- Consumes: Task 1 exports; existing `isSafeId`, `parseAgreements`, `parseWorkflowState`.
- Produces:
  - `UiMessage` adds: `{type:"stateIntent"; text: string}`, `{type:"acceptPlan"}`, `{type:"requestProposal"}`, `{type:"predict"; answer: PredictionAnswer}`, `{type:"skipPrediction"}`, `{type:"run"}`, `{type:"continue"}`, `{type:"explain"; concept: ConceptId}`, `{type:"skipExplain"}` (each with `schema`).
  - `interface GhostChange { kind: "added" | "changed" | "removed" | "referenced"; blockId?: string; afterText?: string }`
  - `HostMessage` adds: `{type:"plan"; tasks: AgentTask[]}`, `{type:"proposal"; proposalId: string; purpose: string; rationale: string; changes: GhostChange[]}`, `{type:"proposalCleared"}`, `{type:"prediction"; questionId: "reaches-goal"; options: PredictionAnswer[]}`, `{type:"comparison"; predicted: PredictionAnswer | "skipped"; reachedGoal: boolean; result: PredictionResult; stepsUsed: number}`, `{type:"explainPrompt"; options: ConceptId[]}`, `{type:"explainFeedback"; result: "relevant" | "other"}`, `{type:"agreements"; agreements: AgentAgreements}`; the `error` code union gains `"STALE_PROPOSAL"`.

- [ ] **Step 1: Implement**

Add the types above (importing `AgentTask`, `ConceptId`, `PredictionAnswer`, `PredictionResult`, `CONCEPT_IDS`, `AGENT_TASK_IDS`, `normalizeIntent` from `@agorix/agent-workflow`). Parser rules:

- `stateIntent`: `normalizeIntent(value["text"])`; reject when `undefined`; output `text` is the normalized string.
- `predict`: `answer` must be `"yes"` or `"no"`. `explain`: `concept` must be in `CONCEPT_IDS`.
- Host `plan`: `tasks` array (max 8) of `{ id: in AGENT_TASK_IDS, title: string (1-120 chars) }`.
- Host `proposal`: `proposalId` safe id; `purpose` and `rationale` strings of 1-300 chars; `changes` array (max 50) of objects with `kind` in the four values, optional `blockId` string (<=128) and optional `afterText` string (<=200).
- Host `prediction`: `questionId === "reaches-goal"`, `options` equal to `["yes","no"]` (accept any non-empty subset of yes/no).
- Host `comparison`: `predicted` in `yes|no|skipped`, `reachedGoal` boolean, `result` in `matched|mismatched|skipped`, `stepsUsed` integer 0-1,000,000.
- Host `explainPrompt`: `options` array (1-4) of `CONCEPT_IDS`. `explainFeedback`: `result` in `relevant|other`. `agreements`: reuse `parseAgreements`. `proposalCleared`: no payload.
- Extend the `error` code check to include `STALE_PROPOSAL`.
- Always rebuild objects from validated fields (drops extra keys, including `__proto__`).

- [ ] **Step 2: Tests**

Round-trip one valid message of each new type; reject: `stateIntent` with empty text, 141 chars, and non-string; `predict` with `"maybe"`; `explain` with `"magic"`; `proposal` with 51 changes, a 301-char purpose and an unsafe id; `comparison` with a negative `stepsUsed`; `plan` with an unknown task id; extra keys are dropped.

- [ ] **Step 3: Verify and commit**

Run: `pnpm prettier --write packages/studio-protocol && pnpm --filter @agorix/studio-protocol test && pnpm --filter @agorix/studio-protocol build`
Expected: PASS.

```bash
git add packages/studio-protocol
git commit -m "feat(studio-protocol): agent loop messages with strict parsing

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: Pure `agentHost`

**Files:**

- Create: `extensions/vscode/src/host/agentHost.ts`, `extensions/vscode/src/host/agentHost.test.ts`

**Interfaces:**

- Consumes: Task 1/2 exports; `advance`, `createWorkflow`, `DEFAULT_AGREEMENTS`, `effectiveAssistance`, `type WorkflowState`, `type AgentAgreements` from `@agorix/agent-workflow`.
- Produces:

```ts
export interface ProposalView {
  proposalId: string;
  purpose: string;
  rationale: string;
  changes: GhostChange[];
}
export interface AgentPort {
  availableTasks(): AgentTaskId[];
  /** Creates and remembers the pending proposal; undefined when the task no longer applies. */
  proposeFor(task: AgentTaskId): ProposalView | undefined;
  /** Applies the pending proposal through the canonical path; "stale" when the program changed. */
  applyPending(): Promise<"applied" | "stale">;
  rejectPending(): void;
  run(): { reachedGoal: boolean; stepsUsed: number } | undefined;
  programHash(): string | undefined;
  record(event: AgentEvent): void;
}
export interface AgentHost {
  /** undefined means "not an agent message"; the caller falls back to the workbench host. */
  handle(message: UiMessage): Promise<HostMessage[] | undefined>;
  snapshot(): HostMessage[];
  onProgramChanged(): HostMessage[];
}
export function createAgentHost(port: AgentPort): AgentHost;
```

- [ ] **Step 1: Implement `createAgentHost`**

State: `workflow: WorkflowState` (init `createWorkflow(agreements.mode)`), `agreements: AgentAgreements`, `tasks: AgentTask[]`, `pending: ProposalView | undefined`, `answer: PredictionAnswer | undefined`, `applying: boolean`, `lastHash: string | undefined`.

Helpers: `wf(): HostMessage` returns `{ schema, type: "workflow", state: workflow }`; `step(event)` runs `advance`, returns `false` on `INVALID_TRANSITION` (and leaves state); `level = () => effectiveAssistance(agreements, 4)`; `currentTask = () => tasks[workflow.taskIndex]`; `cleared = { schema, type: "proposalCleared" }`; `resetLoop(mode = agreements.mode)` sets `workflow = createWorkflow(mode)`, `tasks = []`, `answer = undefined`, and if `pending` calls `port.rejectPending()` and clears it.

`handle` switch on `message.type`, returning `undefined` for non-agent types (`ready`, `intent`, `decideProposal` is agent-handled; `agreementsChanged` is agent-handled):

- `agreementsChanged`: set `agreements = message.agreements`; `resetLoop()`; return `[agreementsMsg, wf()]` plus `cleared` when a proposal had been pending.
- Any other agent message while `!agreements.aiEnabled`: return `[{ schema, type: "agentUnavailable" }]`.
- `stateIntent`: `resetLoop()`; `step({type:"intentStated"})`; `tasks = planTasks(message.text, port.availableTasks())`; return `[wf(), planMsg]` (the plan may be empty; the UI explains that nothing can be suggested).
- `acceptPlan`: require `tasks.length > 0` and `step({type:"planAccepted", taskCount: tasks.length})` else `[]`; if `agreements.mode === "bounded"` continue into the `requestProposal` logic and return its messages after `wf()`; else return `[wf()]`.
- `requestProposal`: require `workflow.stage === "proposal"` and no pending; `step({type:"proposalRequested"})`; `view = port.proposeFor(task.id)`; when `undefined` return `[cleared, wf()]`; else `pending = view`, `port.record({type:"proposalRequested", taskId, scaffoldLevel: level()})`, return `[wf(), proposalMsg]`.
- `decideProposal`: require `workflow.stage === "proposal"`, `workflow.proposalRequested`, `pending !== undefined`, and `message.proposalId === pending.proposalId`; otherwise `[]`. For `accepted`: `applying = true`; `outcome = await port.applyPending()` in `try/finally { applying = false }`; `stale` -> `pending = undefined`, `step({type:"proposalDecided", decision:"rejected"})`, return `[errorStale, cleared, wf()]`; `applied` -> `pending = undefined`, record `proposalAccepted`, `step({type:"proposalDecided", decision:"accepted"})`, `lastHash = port.programHash()`, return `[cleared, wf(), predictionMsg]`. For `rejected`: `port.rejectPending()`, `pending = undefined`, record `proposalRejected`, step rejected, return `[cleared, wf()]`. For `modified`: return `[]`.
- `predict`: `step({type:"predictionMade"})` -> `answer = message.answer`, `[wf()]`, else `[]`. `skipPrediction`: `step({type:"predictionSkipped"})` -> `answer = undefined`, `[wf()]`.
- `run`: require `workflow.stage === "run"`; `observed = port.run()`; `undefined` -> `[]`; `step({type:"runObserved", completed: observed.reachedGoal})`; `result = comparePrediction(answer, observed.reachedGoal)`; record `prediction{Matched|Mismatched|Skipped}`; return `[wf(), comparisonMsg]`.
- `continue`: `step({type:"compared"})` -> `[wf(), explainPromptMsg]` with all `CONCEPT_IDS`.
- `explain`: require task; `result = checkExplanation(task.id, message.concept)`; `step({type:"explained"})` -> record `explainCompleted`; return `[feedbackMsg, wf()]`. `skipExplain`: `step({type:"explainSkipped"})` -> record `explainSkipped`; `[wf()]`.

`snapshot()`: `[agreementsMsg, wf()]`, plus `planMsg` when `tasks.length > 0 && workflow.stage !== "intent"`, plus `proposalMsg` when `pending`.

`onProgramChanged()`: `hash = port.programHash()`; if `applying` or `hash === lastHash` return `[]`; `lastHash = hash`; if `workflow.stage` is `proposal`, `predict`, `run` or `compare`: `const had = pending !== undefined; resetLoop(); return had ? [cleared, wf()] : [wf()]`; else `[]`.

The `task` for events is `currentTask()?.id`; when undefined skip `record`. `proposalMsg`/`planMsg`/`predictionMsg` are small builders with `schema`.

- [ ] **Step 2: Tests (fake `AgentPort` in memory)**

The fake port tracks `programHashValue`, a pending proposal id, `applied` flag, `events[]`, configurable `applyResult`, and `run` result. Cases:

- Full happy path in supervised mode (`stateIntent` -> `acceptPlan` -> `requestProposal` -> `decideProposal accepted` -> `predict yes` -> `run` -> `continue` -> `explain sequence`): final `workflow.stage` is `done`, `comparison.result` matches, events are exactly `proposalRequested, proposalAccepted, predictionMatched, explainCompleted`, and `applyPending` ran once.
- Bounded mode: `acceptPlan` already returns a `proposal` message and `applyPending` has not run.
- Rejection: `decideProposal rejected` leaves `applied` false and the stage `proposal`; then `requestProposal` works again; reject twice does not wedge.
- Wrong id, decision before `requestProposal`, decision twice after accept, and a decision in stage `predict` all return `[]` and never call `applyPending` a second time.
- Stale: `applyResult = "stale"` returns an `error STALE_PROPOSAL` + `proposalCleared` and does not advance to `predict`.
- `skipPrediction` then `run` gives `result: "skipped"`; `skipExplain` finishes the task; none of them blocks.
- `onProgramChanged` with a different hash while in `predict` resets to stage `intent`; during `applyPending` (simulate by making the fake call `host.onProgramChanged()` inside `applyPending`) it returns `[]`.
- AI disabled: `agreementsChanged {aiEnabled:false}` clears; then `stateIntent` returns exactly `[{type:"agentUnavailable"}]`; re-enabling starts at `intent`.
- `handle({type:"ready"})` and `handle({type:"intent",...})` return `undefined`.
- `planTasks` empty (`availableTasks() === []`): `stateIntent` returns an empty `plan`; `acceptPlan` returns `[]`.

- [ ] **Step 3: Verify and commit**

Run: `pnpm prettier --write extensions/vscode/src/host && pnpm vitest run extensions/vscode/src/host && pnpm --filter agorix-studio typecheck`
Expected: PASS.

```bash
git add extensions/vscode
git commit -m "feat(studio): pure agent host driving the Director/Auditor loop

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Extension port and panel composition

**Files:**

- Create: `extensions/vscode/src/host/agentPort.ts`, `extensions/vscode/src/host/agentPort.test.ts`
- Modify: `extensions/vscode/src/host/workbenchPanel.ts`, `extensions/vscode/src/store/session.ts`, `extensions/vscode/src/extension.ts`, `extensions/vscode/src/extension.test.ts`

**Interfaces:**

- Consumes: `AgentPort`, `ProposalView` (Task 3); `suggestFirstStep`, `suggestRepeat`, `assertProposalFresh`, `type StudioProposalSession`, `createExecutionEvidence` (`../studioCore.js`); `programToWorkspace` (`@agorix/block-editor`); `touchingGoal` (`@agorix/runtime`); `programSemanticHash` (`@agorix/proposals`); `MAX_AGENT_EVENTS`, `type AgentEvent` (`@agorix/agent-workflow`).
- Produces: `createAgentPort(deps): AgentPort` where `deps = { getProject(): StudioProject | undefined; getActiveProposal(): StudioProposalSession | undefined; setActiveProposal(s: StudioProposalSession | undefined): void; applyActiveProposal(): Promise<void>; rejectActiveProposal(): void; runAndGetResult(): { world: WorldState; stepsUsed: number } | undefined; events: AgentEvent[] }`; `openWorkbenchPanel(context, port, agentPort)` signature.

- [ ] **Step 1: Session store**

In `store/session.ts` add `readonly agentEvents: AgentEvent[]` to `StudioSessionState`, initialise to `[]`, and clear it (`length = 0`) in `clearProjectSession`.

- [ ] **Step 2: `agentPort.ts`**

```ts
import { MAX_AGENT_EVENTS, type AgentEvent, type AgentTaskId } from "@agorix/agent-workflow";
import { programToWorkspace } from "@agorix/block-editor";
import { programSemanticHash } from "@agorix/proposals";
import { touchingGoal, type WorldState } from "@agorix/runtime";
import {
  assertProposalFresh,
  suggestFirstStep,
  suggestRepeat,
  type StudioProject,
  type StudioProposalSession,
} from "../studioCore.js";
import type { AgentPort, ProposalView } from "./agentHost.js";

export interface AgentPortDeps {
  getProject(): StudioProject | undefined;
  getActiveProposal(): StudioProposalSession | undefined;
  setActiveProposal(session: StudioProposalSession | undefined): void;
  applyActiveProposal(): Promise<void>;
  rejectActiveProposal(): void;
  runAndGetResult(): { world: WorldState; stepsUsed: number } | undefined;
  events: AgentEvent[];
}

function viewOf(project: StudioProject, session: StudioProposalSession): ProposalView {
  const { mapping } = programToWorkspace(project.stored.program);
  const blockFor = new Map(mapping.map((entry) => [entry.nodeId, entry.blockId]));
  return {
    proposalId: session.review.proposal.id,
    purpose: session.purpose.slice(0, 300),
    rationale: session.rationale.slice(0, 300),
    changes: session.diff.changes.slice(0, 50).map((change) => {
      const blockId = blockFor.get(change.nodeId);
      return {
        kind: change.kind,
        ...(blockId === undefined ? {} : { blockId }),
        ...(change.afterText === undefined ? {} : { afterText: change.afterText.slice(0, 200) }),
      };
    }),
  };
}

export function createAgentPort(deps: AgentPortDeps): AgentPort {
  return {
    availableTasks(): AgentTaskId[] {
      const project = deps.getProject();
      if (project === undefined) return [];
      const tasks: AgentTaskId[] = [];
      if (suggestFirstStep(project) !== undefined) tasks.push("first-step");
      if (suggestRepeat(project) !== undefined) tasks.push("repeat-pattern");
      return tasks;
    },
    proposeFor(task) {
      const project = deps.getProject();
      if (project === undefined) return undefined;
      const suggestion = task === "first-step" ? suggestFirstStep(project) : suggestRepeat(project);
      if (suggestion === undefined) return undefined;
      deps.setActiveProposal(suggestion.session);
      return viewOf(project, suggestion.session);
    },
    async applyPending() {
      const project = deps.getProject();
      const session = deps.getActiveProposal();
      if (project === undefined || session === undefined) return "stale";
      try {
        assertProposalFresh(project.stored.program, session);
      } catch {
        deps.setActiveProposal(undefined);
        return "stale";
      }
      await deps.applyActiveProposal();
      return "applied";
    },
    rejectPending() {
      if (deps.getActiveProposal() !== undefined) {
        deps.rejectActiveProposal();
      }
    },
    run() {
      const result = deps.runAndGetResult();
      return result === undefined
        ? undefined
        : { reachedGoal: touchingGoal(result.world), stepsUsed: result.stepsUsed };
    },
    programHash() {
      const project = deps.getProject();
      return project === undefined ? undefined : programSemanticHash(project.stored.program);
    },
    record(event) {
      deps.events.push(event);
      if (deps.events.length > MAX_AGENT_EVENTS) {
        deps.events.splice(0, deps.events.length - MAX_AGENT_EVENTS);
      }
    },
  };
}
```

If `ProposalDiffEntry.nodeId` values are not in the same namespace as `BlockMappingEntry.nodeId`, `changes` simply carry no `blockId`; the test below pins the behavior for the repeat proposal (`changed`/`removed` entries must resolve to a block id) and, if it fails, ledger the mismatch and map by statement index instead.

- [ ] **Step 3: Wire the panel and `extension.ts`**

In `workbenchPanel.ts`: import `createAgentHost`, `AgentPort`; change `openWorkbenchPanel(context, port, agentPort)`; create `agent = createAgentHost(agentPort)` next to `host`; in `onDidReceiveMessage` do `const out = (await agent.handle(message)) ?? (await host.handle(message))` inside the existing `void ... .then(send)` chain; on `ready` the agent branch returns `undefined` so first send `host.handle(message)` result then `agent.snapshot()` (handle `ready` specially: `if (message.type === "ready") { await send(await host.handle(message)); await send(agent.snapshot()); return; }`). `refreshWorkbench()` sends `host.snapshot()` then `agent.onProgramChanged()`. `disposeWorkbench()` clears `agent`. Keep every existing guard (single panel, malformed message ignored).

In `extension.ts` add `agentPortFor()` building `createAgentPort` over the session: `getProject: () => session.current?.project`, `getActiveProposal: () => session.activeProposal`, `setActiveProposal: (s) => { session.activeProposal = s; refreshCompanionViews(); }`, `applyActiveProposal`, `rejectActiveProposal`, `runAndGetResult: () => { runExecution(); const r = session.executionEvidence?.result; return r === undefined ? undefined : { world: r.world, stepsUsed: r.stepsUsed }; }`, `events: session.agentEvents`. Pass it as the third argument in the `openWorkbench` command.

- [ ] **Step 4: Tests**

`agentPort.test.ts` with a real `StudioProject` from `createStudioStarterProject` (blank starter): `availableTasks()` contains `first-step` for an empty script and not `repeat-pattern`; for a project with three identical `move` statements it contains `repeat-pattern`; `proposeFor("first-step")` returns a view with `purpose` and sets the active proposal; for the repeat proposal at least one change has a `blockId` (see note above); `applyPending` returns `"stale"` and does not call `applyActiveProposal` after the program hash changed; `run()` maps `touchingGoal`; `record` caps at 200.

In `extension.test.ts` add: after `openWorkbench` the webview receives `ready` -> messages include `workflow` and `agreements`; a `stateIntent` message sent to the panel produces `workflow` stage `plan` and a `plan` message; sending `requestProposal` then `decideProposal rejected` leaves the written file untouched (compare raw before/after); full `accepted` path writes the file and a later `undoProposal` restores it (same undo stack); malformed/oversize `stateIntent` is ignored.

- [ ] **Step 5: Verify and commit**

Run: `pnpm prettier --write extensions/vscode && pnpm --filter agorix-studio build && pnpm --filter agorix-studio test && pnpm lint`
Expected: PASS.

```bash
git add extensions/vscode
git commit -m "feat(studio): wire the agent host into the Workbench through the proposal path

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Agent column in `studio-ui` and ghost blocks

**Files:**

- Create: `packages/studio-ui/src/agentUi.ts`, `packages/studio-ui/src/AgentPanel.tsx`, `packages/studio-ui/src/agent.test.tsx`
- Modify: `packages/studio-ui/src/Canvas.tsx`, `Workbench.tsx`, `styles.ts`, `index.ts`

**Interfaces:**

- Consumes: Task 2 message types (`HostMessage`, `UiMessage`, `GhostChange`), `STUDIO_PROTOCOL_VERSION`, `DEFAULT_AGREEMENTS`, `type WorkflowState`, `type AgentAgreements`, `CONCEPT_IDS`.
- Produces:
  - `interface AgentUiState { workflow?: WorkflowState; agreements: AgentAgreements; tasks?: AgentTask[]; proposal?: { proposalId: string; purpose: string; rationale: string; changes: GhostChange[] }; prediction?: PredictionAnswer[]; comparison?: Extract<HostMessage, {type:"comparison"}>; explain?: ConceptId[]; feedback?: "relevant" | "other"; available: boolean; notice?: string }`
  - `initialAgentUi(): AgentUiState` and `reduceAgentUi(state: AgentUiState, message: HostMessage): AgentUiState`
  - `AgentPanel({ state, send }: { state: AgentUiState; send(message: UiMessage): void })`
  - `Canvas` gains optional prop `ghosts?: readonly GhostChange[]`

- [ ] **Step 1: `agentUi.ts` reducer**

Rules: `workflow` replaces `workflow`; when the new stage is `intent` clear `tasks`, `proposal`, `prediction`, `comparison`, `explain`, `feedback`; when it leaves `explain` clear `explain`; when the stage is not `compare` clear `comparison`... except keep `comparison` while stage is `compare` or `explain`. `plan` sets `tasks`; `proposal` sets `proposal` (and clears `notice`); `proposalCleared` clears `proposal`; `prediction` sets `prediction` options; `comparison` sets `comparison` and clears `prediction`; `explainPrompt` sets `explain`; `explainFeedback` sets `feedback` and clears `explain`; `agreements` sets `agreements` and sets `available = agreements.aiEnabled`; `agentUnavailable` sets `available = false` and `notice = "The agent is off right now. Everything else still works."`; `error` with `STALE_PROPOSAL` sets `notice = "The program changed, so that suggestion was dropped. Nothing was applied."`; other messages return the state unchanged. `available` starts `true`.

- [ ] **Step 2: `AgentPanel.tsx`**

Render (labels in English, short, icon-optional; all controls real `<button>`/`<input>`/`<select>` elements, no inline styles):

- **Agreements** (`<details>` closed by default titled "Agent agreements"): checkbox "Agent helps" bound to `aiEnabled`; select "How it works" with `supervised` "Ask me before each suggestion" and `bounded` "Suggest after I accept the plan"; select "Help level up to" 0-5. Changing any posts `{type:"agreementsChanged", agreements}` with the full object.
- **Ribbon**: `<ol aria-label="Agent loop">` of `Intent, Plan, Proposal, Predict, Run, Compare, Explain`; the item matching `workflow.stage` has `aria-current="step"`; stage `done` shows all as done (class `done`).
- **Intent bar** (stage `intent`/`done` or no workflow): a `<form>` with `<label>` "What do you want to make?", `<input maxLength={140}>`, submit "Ask"; submit posts `{type:"stateIntent", text}` and clears the field; disabled with the calm notice when `!state.available`.
- **Plan card** (stage `plan`): lists `tasks` titles as `<ul>`; empty list shows "I can't suggest anything right now. Try changing the program first."; button "Use this plan" posts `acceptPlan`.
- **Proposal card** (stage `proposal`): if no `proposal` and `workflow.proposalRequested === false` show button "Show me a suggestion" posting `requestProposal`; with a `proposal` show a `<section aria-label="Suggestion">` badge "Suggestion (AI, not in your program yet)", purpose, rationale, ghost legend, and buttons "Accept" and "Reject" posting `decideProposal` with `proposalId` and `accepted`/`rejected`.
- **Prediction card** (stage `predict` with `prediction`): "Will the character reach the goal?" with buttons Yes, No, Skip posting `predict yes|no` or `skipPrediction`.
- **Run card** (stage `run`): button "Run it" posting `run`.
- **Comparison card** (stage `compare` with `comparison`): text "You predicted: Yes/No/Skipped. The run showed: reached the goal / did not reach the goal (runtime fact, N steps)." plus a neutral mismatch hint "That is a good thing to look at." (no success/failure styling); button "Continue" posting `continue`.
- **Explain card** (stage `explain` with `explain`): "Which idea made this work?" with one button per concept (labels Sequence, Repetition, Condition, Event) posting `explain`, and "Skip" posting `skipExplain`; after `feedback` show "That fits" for `relevant` and "Another idea fits better, but your answer is noted" for `other` (no scoring).
- `state.notice` renders in a `role="status" aria-live="polite"` line.

Add CSS: `.agent` column, `.ribbon li[aria-current="step"]` bold with outline, `.suggestion` dashed border using `var(--vscode-editorInfo-foreground)`, `.ghost-added`, `.ghost-changed`, `.ghost-removed` (dashed outline, `.ghost-removed` line-through), `.ghost-badge`.

- [ ] **Step 3: Ghost marks in `Canvas`**

New prop `ghosts`. For each `block` row whose `block.id` appears as a `blockId` in `ghosts`, add class `ghost-changed` (kind `changed`/`referenced`) or `ghost-removed` (kind `removed`) and an `aria-description` of "Suggestion would change this block" / "Suggestion would remove this block". After the last row of script 0 render each `added` ghost as `<div className="block ghost-added" aria-label={"Suggested: " + afterText}>` showing `afterText` and a badge "Suggestion"; ghost rows are not draggable and not focusable for edits. Ghost block ids that match no row are ignored.

- [ ] **Step 4: `Workbench`**

Hold `agentUi` state with `useReducer(reduceAgentUi, undefined, initialAgentUi)`; feed every host message to it in the existing subscription; render `<AgentPanel>` in a third column; pass `ghosts={agentUi.proposal?.changes}` to `Canvas`; keep the existing `statusFor` handling for `error`/`agentUnavailable`. Update the layout CSS to a three-column grid (`palette | canvas | agent`) that collapses to one column below 900px.

- [ ] **Step 5: Tests (`agent.test.tsx`)**

- Reducer: `proposalCleared` clears; `workflow` to `intent` clears cards; `error STALE_PROPOSAL` sets the notice; `agentUnavailable` sets `available=false`; `agreements` mirrors `aiEnabled`.
- Render with `renderToStaticMarkup`: the ribbon marks the current stage with `aria-current="step"`; the proposal card contains "Suggestion (AI, not in your program yet)" and buttons "Accept" and "Reject" and no success-styled class names; the intent bar input has `maxlength="140"`; the intent bar is `disabled` when `available=false`; no `style=` attribute anywhere.
- Canvas ghosts: a `changed` ghost adds `ghost-changed` to the matching block and `aria-description`; an unknown `blockId` changes nothing; an `added` ghost renders after the blocks with the badge and without `draggable`.

- [ ] **Step 6: Verify and commit**

Run: `pnpm prettier --write packages/studio-ui && pnpm --filter @agorix/studio-ui test && pnpm --filter @agorix/studio-ui build && pnpm --filter agorix-studio build && pnpm lint`
Expected: PASS.

```bash
git add packages/studio-ui extensions/vscode
git commit -m "feat(studio-ui): agent column, ghost blocks and the visible Director/Auditor loop

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Docs, gate evidence and PR

**Files:**

- Modify: `docs/product/STUDIO_AGENT.md`, `docs/product/AGORIX_STUDIO.md`, `docs/product/STUDIO_RELEASE_GATE.md`

- [ ] **Step 1: Update docs**

In `STUDIO_AGENT.md` add a section "Workbench agent slice" listing what is implemented (intent bar, plan, ghost proposals, predict/run/compare/explain, agreements, non-PII events) and what is not (provider-backed proposals, modify decision, CodeLens and proactive offers, evidence export, alternatives, Mission Spec). In `AGORIX_STUDIO.md` add a surface-table row `Agent column | Director/Auditor loop beside the canvas; proposals appear as ghost blocks.` In `STUDIO_RELEASE_GATE.md` add a parity/journey row "Agent loop on the Workbench" with shared contract `ProgramProposal`, `agent-workflow`, `studio-protocol`; evidence `extensions/vscode/src/host/agentHost.test.ts`, `packages/studio-ui/src/agent.test.tsx`, `extensions/vscode/src/extension.test.ts`; intentional difference "Studio shows ghost blocks and a loop ribbon; Web uses ghost blocks beside the Agorix Agent character (Plan C)"; status Green only if CI is green.

- [ ] **Step 2: Full verification and PR**

Run: `pnpm prettier --write docs && pnpm lint && pnpm format:check && pnpm test && pnpm build && pnpm security:check`
Expected: PASS.

```bash
git add docs
git commit -m "docs(studio): document the Workbench agent slice and gate evidence

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin docs/studio-agent-workbench-plan
gh pr create --base main --title "Studio agent on the Workbench: intent, ghost proposals and the Director/Auditor loop" --body "Implements Plan D (docs/superpowers/plans/2026-10-04-studio-agent-on-workbench.md). Deterministic proposals only; no provider calls.

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Do not self-merge.

---

## Self-review

- **Spec coverage:** D4 (Mission Spec flow in a minimal form: intent -> plan -> tasks -> proposal -> predict -> run -> compare -> explain; agreements; visible loop ribbon) -> Tasks 1-5; D5 agent presence (ghost blocks, loop ribbon) -> Task 5; supervised/bounded -> Task 3; non-PII events -> Tasks 1 and 4. Issues covered: #248, #249, ghost part of #256. Not covered, by design: provider-backed proposals, modify decision, alternatives (#257), proactive/ambient presence and CodeLens (#250, #258), evidence export (#251), canvas/code/World/Inspector sync (#255), Mission Spec editing, density levels, Web (Plan C), cross-surface gate.
- **Placeholders:** none; UI tasks are specified by exact behavior and pinned by named tests, like Plan B.
- **Type consistency:** `AgentTaskId`, `AgentTask`, `PredictionAnswer`, `PredictionResult`, `ConceptId`, `AgentEvent`, `GhostChange`, `ProposalView`, `AgentPort`, `AgentHost` are defined once and reused with the same names.
- **Review Focus pinned:** stale proposal and wrong-id/stage/double decisions (Task 3), external-edit reset (Task 3), intent text bounds (Tasks 1 and 2), reject-twice (Task 3), bounded mode (Task 3), AI off (Task 3), unknown ghost ids (Task 5), file untouched on reject and undo parity (Task 4).
- **Known risks:** diff `nodeId` vs mapping `nodeId` namespace (Task 4 note); `runExecution()` updates the existing execution views as a side effect, which is intended; the first-mission goal may be unreachable with the empty starter, so the first comparison often reads "did not reach the goal", which is honest evidence.
