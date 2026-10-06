import {
  AGENT_TASK_IDS,
  CONCEPT_IDS,
  normalizeIntent,
  type AgentAgreements,
  type AgentTask,
  type AgentTaskId,
  type AssistanceLevel,
  type ConceptId,
  type OfferableSignal,
  type PredictionAnswer,
  type PredictionResult,
  type WorkflowMode,
  type WorkflowStage,
  type WorkflowState,
} from "@agorix/agent-workflow";
import type {
  BlockNode,
  PlacementReason,
  BlockScript,
  BlockType,
  BlockWorkspaceSnapshot,
} from "@agorix/block-editor";
import { isSafeId, parseAnchorRef, type Intent } from "@agorix/interaction-core";

/** Versioned host <-> UI messages. UIs send intents; the host owns canonical mutation. */
export const STUDIO_PROTOCOL_VERSION = "agorix/studio-protocol/v1";
export const PACKAGE_NAME = "@agorix/studio-protocol";

/** Help shown instead of a proposal when the learner's assistance ceiling is below 4. */
export type HelpShown = "none" | "question" | "concept" | "pointer";
const HELP_SHOWN: readonly HelpShown[] = ["none", "question", "concept", "pointer"];

/** How the Workbench is laid out: spacing and size only; no information is ever hidden. */
export type Density = "comfortable" | "compact";
export type DensityPreference = Density | "auto";

/** Canvas edits in one session after which `auto` becomes compact. */
export const AUTO_DENSITY_EDITS = 8;

export interface ExperienceFacts {
  /** Successful learner edits on the canvas this session. */
  readonly edits: number;
  /** The program has reached the goal in the deterministic runtime at least once this session. */
  readonly reachedGoal: boolean;
}

/**
 * Comfortable for first use, compact once the learner has shown fluency. A pinned preference
 * always wins. The rule uses only local, non-personal facts.
 */
export function resolveDensity(preference: DensityPreference, facts: ExperienceFacts): Density {
  if (preference !== "auto") return preference;
  return facts.reachedGoal || facts.edits >= AUTO_DENSITY_EDITS ? "compact" : "comfortable";
}

export function normalizeDensityPreference(value: unknown): DensityPreference {
  return value === "comfortable" || value === "compact" ? value : "auto";
}

export type ChangeRefusalReason = PlacementReason | "WOULD_BREAK_PROGRAM" | "UNKNOWN";
const REFUSAL_REASONS: readonly ChangeRefusalReason[] = [
  "NOT_A_CONTAINER",
  "BAD_INDEX",
  "BLOCK_NOT_FOUND",
  "NOT_A_STATEMENT",
  "WOULD_BREAK_PROGRAM",
  "UNKNOWN",
];

type Schema = typeof STUDIO_PROTOCOL_VERSION;
type Decision = "accepted" | "rejected" | "modified";

export type UiMessage =
  | { readonly schema: Schema; readonly type: "ready" }
  | {
      readonly schema: Schema;
      readonly type: "intent";
      readonly intent: Intent;
      /** Program hash the UI last saw; the host refuses mutating intents when it is stale. */
      readonly baseHash?: string;
    }
  | {
      readonly schema: Schema;
      readonly type: "agreementsChanged";
      readonly agreements: AgentAgreements;
    }
  | {
      readonly schema: Schema;
      readonly type: "decideProposal";
      readonly proposalId: string;
      readonly decision: Decision;
      readonly selection?: SelectionInput;
    }
  | { readonly schema: Schema; readonly type: "chooseAlternative"; readonly proposalId: string }
  | {
      readonly schema: Schema;
      readonly type: "previewSelection";
      readonly proposalId: string;
      readonly selection: SelectionInput;
    }
  | { readonly schema: Schema; readonly type: "stateIntent"; readonly text: string }
  | { readonly schema: Schema; readonly type: "acceptPlan" }
  | { readonly schema: Schema; readonly type: "answerClarification"; readonly taskId: AgentTaskId }
  | { readonly schema: Schema; readonly type: "requestProposal" }
  | { readonly schema: Schema; readonly type: "predict"; readonly answer: PredictionAnswer }
  | { readonly schema: Schema; readonly type: "skipPrediction" }
  | { readonly schema: Schema; readonly type: "run" }
  | { readonly schema: Schema; readonly type: "continue" }
  | { readonly schema: Schema; readonly type: "explain"; readonly concept: ConceptId }
  | { readonly schema: Schema; readonly type: "skipExplain" };

export interface OperationView {
  readonly index: number;
  readonly kind: "add" | "replace" | "remove" | "setField";
  readonly label: string;
  readonly blockId?: string;
  readonly editable?: { readonly field: "steps" | "degrees" | "count"; readonly value: number };
}

/** Measured by running the candidate program in the deterministic runtime. */
export interface EvidenceView {
  readonly stepsUsed: number;
  readonly reachedGoal: boolean;
  readonly outcome: "completed" | "budget-exceeded" | "stopped";
}

export interface AlternativeView {
  readonly proposalId: string;
  readonly purpose: string;
  readonly tradeoff: string;
  readonly evidence: EvidenceView;
}

export interface SelectionInput {
  readonly include: readonly number[];
  readonly overrides?: readonly { readonly index: number; readonly value: number }[];
}

export interface GhostChange {
  readonly kind: "added" | "changed" | "removed" | "referenced";
  readonly blockId?: string;
  readonly afterText?: string;
}

export interface AmbientHintView {
  readonly label: string;
  readonly blockId?: string;
  readonly actions: readonly ("explain" | "debug" | "challenge" | "propose")[];
}

export type HostMessage =
  | { readonly schema: Schema; readonly type: "workflow"; readonly state: WorkflowState }
  | { readonly schema: Schema; readonly type: "programHash"; readonly hash: string }
  | { readonly schema: Schema; readonly type: "agentUnavailable" }
  | {
      readonly schema: Schema;
      readonly type: "workspace";
      readonly workspace: BlockWorkspaceSnapshot;
      readonly programHash: string;
    }
  | {
      readonly schema: Schema;
      readonly type: "error";
      readonly code:
        | "INVALID_CHANGE"
        | "INVALID_PROGRAM"
        | "STALE_PROPOSAL"
        | "STALE_EDIT"
        | "STALE_PLAN"
        | "PREDICTION_REQUIRED";
      /** Why a change was refused, only with INVALID_CHANGE. */
      readonly reason?: ChangeRefusalReason;
    }
  | { readonly schema: Schema; readonly type: "plan"; readonly tasks: readonly AgentTask[] }
  | { readonly schema: Schema; readonly type: "clarify"; readonly options: readonly AgentTask[] }
  | {
      readonly schema: Schema;
      readonly type: "proposal";
      readonly proposalId: string;
      readonly purpose: string;
      readonly rationale: string;
      readonly changes: readonly GhostChange[];
      readonly operations?: readonly OperationView[];
      readonly evidence?: EvidenceView;
      readonly alternatives?: readonly AlternativeView[];
      /** Where the proposal came from: an AI provider or the built-in deterministic helper. */
      readonly origin?: "provider" | "built-in";
      /** Learner-safe note, for example when the agent fell back to built-in help. */
      readonly notice?: string;
    }
  | {
      readonly schema: Schema;
      readonly type: "selectionEvidence";
      readonly proposalId: string;
      readonly result:
        | { readonly ok: true; readonly evidence: EvidenceView }
        | { readonly ok: false; readonly reason: "EMPTY" | "INVALID" | "STALE" };
    }
  | { readonly schema: Schema; readonly type: "proposalCleared" }
  | {
      readonly schema: Schema;
      readonly type: "prediction";
      readonly questionId: "reaches-goal";
      readonly options: readonly PredictionAnswer[];
    }
  | {
      readonly schema: Schema;
      readonly type: "comparison";
      readonly predicted: PredictionAnswer | "skipped";
      readonly reachedGoal: boolean;
      readonly result: PredictionResult;
      readonly stepsUsed: number;
    }
  | {
      readonly schema: Schema;
      readonly type: "explainPrompt";
      readonly options: readonly ConceptId[];
    }
  | {
      readonly schema: Schema;
      readonly type: "explainFeedback";
      readonly result: "relevant" | "other";
    }
  | { readonly schema: Schema; readonly type: "agreements"; readonly agreements: AgentAgreements }
  | { readonly schema: Schema; readonly type: "ambientHint"; readonly hint?: AmbientHintView }
  | {
      readonly schema: Schema;
      readonly type: "help";
      readonly kind: HelpShown;
      readonly ceiling: number;
      readonly taskId: AgentTaskId;
      readonly concept?: ConceptId;
      /** Blocks the learner is pointed to (ceiling 3). */
      readonly blockIds?: readonly string[];
    }
  | {
      readonly schema: Schema;
      readonly type: "density";
      readonly value: Density;
      /** "auto" when the layout changed by itself, "setting" when the learner chose it. */
      readonly reason: "auto" | "setting";
    }
  | {
      readonly schema: Schema;
      readonly type: "sync";
      readonly selectedBlockId?: string;
      readonly executingBlockId?: string;
      readonly failedBlockId?: string;
    };

const DECISIONS: readonly Decision[] = ["accepted", "rejected", "modified"];
const STAGES: readonly WorkflowStage[] = [
  "intent",
  "plan",
  "proposal",
  "predict",
  "run",
  "compare",
  "explain",
  "done",
];
const MODES: readonly WorkflowMode[] = ["supervised", "bounded"];
const SIGNALS: readonly OfferableSignal[] = [
  "runtime-error",
  "stalled",
  "repeated-error",
  "repeat-pattern",
  "first-step",
];
const AGENT_VERBS = ["explain", "debug", "challenge"] as const;
const BLOCK_TYPES = [
  "event_on_start",
  "event_green_flag",
  "motion_move",
  "motion_turn",
  "control_repeat",
  "control_if",
  "sensing_touching_goal",
  "literal_boolean",
  "literal_number",
] as const;

type Obj = Record<string, unknown>;
type Container = Extract<Intent, { type: "insertBlock" }>["to"]["container"];
type Location = { container: Container; index: number };

function isObject(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100_000;
}

function parseContainer(value: unknown): Container | undefined {
  if (!isObject(value) || !isIndex(value["scriptIndex"])) {
    return undefined;
  }
  const scriptIndex = value["scriptIndex"];
  if (value["kind"] === "script") {
    return { kind: "script", scriptIndex };
  }
  const path = value["statementPath"];
  if (
    (value["kind"] === "repeatBody" || value["kind"] === "ifThen") &&
    Array.isArray(path) &&
    path.length <= 16 &&
    path.every(isIndex)
  ) {
    return { kind: value["kind"], scriptIndex, statementPath: [...path] as number[] };
  }
  return undefined;
}

function parseLocation(value: unknown): Location | undefined {
  if (!isObject(value) || !isIndex(value["index"])) {
    return undefined;
  }
  const container = parseContainer(value["container"]);
  return container === undefined ? undefined : { container, index: value["index"] };
}

function parseIntent(value: unknown): Intent | undefined {
  if (!isObject(value)) {
    return undefined;
  }
  switch (value["type"]) {
    case "insertBlock": {
      const to = parseLocation(value["to"]);
      const blockType = (BLOCK_TYPES as readonly unknown[]).includes(value["blockType"])
        ? (value["blockType"] as (typeof BLOCK_TYPES)[number])
        : undefined;
      return to === undefined || blockType === undefined
        ? undefined
        : { type: "insertBlock", blockType, to };
    }
    case "moveBlock": {
      const from = parseLocation(value["from"]);
      const to = parseLocation(value["to"]);
      return from === undefined || to === undefined ? undefined : { type: "moveBlock", from, to };
    }
    case "deleteBlock": {
      const location = parseLocation(value["location"]);
      return location === undefined ? undefined : { type: "deleteBlock", location };
    }
    case "askAgent": {
      const about = parseAnchorRef(value["about"]);
      const verb = (AGENT_VERBS as readonly unknown[]).includes(value["verb"])
        ? (value["verb"] as (typeof AGENT_VERBS)[number])
        : undefined;
      return about === undefined || verb === undefined
        ? undefined
        : { type: "askAgent", verb, about };
    }
    case "revealNode":
      return isSafeId(value["nodeId"])
        ? { type: "revealNode", nodeId: value["nodeId"] }
        : undefined;
    case "highlightNodes": {
      const ids = value["nodeIds"];
      return Array.isArray(ids) && ids.length > 0 && ids.length <= 16 && ids.every(isSafeId)
        ? { type: "highlightNodes", nodeIds: [...ids] as string[] }
        : undefined;
    }
    case "reviewProposal":
      return isSafeId(value["proposalId"])
        ? { type: "reviewProposal", proposalId: value["proposalId"] }
        : undefined;
    default:
      return undefined;
  }
}

function parseAgreements(value: unknown): AgentAgreements | undefined {
  if (!isObject(value) || typeof value["aiEnabled"] !== "boolean") {
    return undefined;
  }
  const ceiling = value["assistanceCeiling"];
  const mode = value["mode"];
  const proactive = value["proactive"];
  if (
    typeof ceiling !== "number" ||
    !Number.isInteger(ceiling) ||
    ceiling < 0 ||
    ceiling > 5 ||
    !(MODES as readonly unknown[]).includes(mode) ||
    !isObject(proactive)
  ) {
    return undefined;
  }
  const requirePrediction = value["requirePredictionBeforeAccept"];
  if (requirePrediction !== undefined && typeof requirePrediction !== "boolean") {
    return undefined;
  }
  const flags = {} as Record<OfferableSignal, boolean>;
  for (const signal of SIGNALS) {
    const flag = proactive[signal];
    if (typeof flag !== "boolean") {
      return undefined;
    }
    flags[signal] = flag;
  }
  return {
    aiEnabled: value["aiEnabled"],
    assistanceCeiling: ceiling as AssistanceLevel,
    mode: mode as WorkflowMode,
    requirePredictionBeforeAccept: requirePrediction ?? false,
    proactive: flags,
  };
}

function parseWorkflowState(value: unknown): WorkflowState | undefined {
  if (!isObject(value)) {
    return undefined;
  }
  const { stage, mode, taskIndex, taskCount, rejections } = value;
  if (
    !(STAGES as readonly unknown[]).includes(stage) ||
    !(MODES as readonly unknown[]).includes(mode) ||
    !isIndex(taskIndex) ||
    !isIndex(taskCount) ||
    !isIndex(rejections) ||
    typeof value["proposalRequested"] !== "boolean" ||
    typeof value["predicted"] !== "boolean" ||
    typeof value["explained"] !== "boolean" ||
    typeof value["completed"] !== "boolean"
  ) {
    return undefined;
  }
  return {
    stage: stage as WorkflowStage,
    mode: mode as WorkflowMode,
    taskIndex,
    taskCount,
    rejections,
    proposalRequested: value["proposalRequested"],
    predicted: value["predicted"],
    explained: value["explained"],
    completed: value["completed"],
  };
}

const HASH_PATTERN = /^[A-Za-z0-9:_-]{1,128}$/;
const MAX_SCRIPTS = 64;
const MAX_DEPTH = 16;
const MAX_NODES = 2000;

function parseBlock(
  value: unknown,
  depth: number,
  budget: { nodes: number },
): BlockNode | undefined {
  budget.nodes -= 1;
  if (!isObject(value) || depth > MAX_DEPTH || budget.nodes < 0) {
    return undefined;
  }
  const { id, type } = value;
  if (typeof id !== "string" || id.length === 0 || id.length > 128) {
    return undefined;
  }
  if (!(BLOCK_TYPES as readonly unknown[]).includes(type)) {
    return undefined;
  }
  const out: {
    id: string;
    type: BlockType;
    fields?: Record<string, unknown>;
    inputs?: { body?: BlockNode[]; then?: BlockNode[]; condition?: BlockNode };
  } = { id, type: type as BlockType };
  const fields = value["fields"];
  if (fields !== undefined) {
    if (!isObject(fields)) {
      return undefined;
    }
    const safe: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(fields)) {
      if (typeof field !== "number" && typeof field !== "boolean" && typeof field !== "string") {
        return undefined;
      }
      safe[key] = field;
    }
    out.fields = safe;
  }
  const inputs = value["inputs"];
  if (inputs !== undefined) {
    if (!isObject(inputs)) {
      return undefined;
    }
    const parsed: { body?: BlockNode[]; then?: BlockNode[]; condition?: BlockNode } = {};
    for (const key of ["body", "then"] as const) {
      if (inputs[key] !== undefined) {
        const blocks = parseBlockList(inputs[key], depth + 1, budget);
        if (blocks === undefined) {
          return undefined;
        }
        parsed[key] = blocks;
      }
    }
    if (inputs["condition"] !== undefined) {
      const condition = parseBlock(inputs["condition"], depth + 1, budget);
      if (condition === undefined) {
        return undefined;
      }
      parsed.condition = condition;
    }
    out.inputs = parsed;
  }
  return out;
}

function parseBlockList(
  value: unknown,
  depth: number,
  budget: { nodes: number },
): BlockNode[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const blocks: BlockNode[] = [];
  for (const item of value) {
    const block = parseBlock(item, depth, budget);
    if (block === undefined) {
      return undefined;
    }
    blocks.push(block);
  }
  return blocks;
}

function parseWorkspace(value: unknown): BlockWorkspaceSnapshot | undefined {
  if (
    !isObject(value) ||
    !Array.isArray(value["scripts"]) ||
    value["scripts"].length > MAX_SCRIPTS
  ) {
    return undefined;
  }
  const budget = { nodes: MAX_NODES };
  const scripts: BlockScript[] = [];
  for (const raw of value["scripts"] as unknown[]) {
    if (!isObject(raw) || typeof raw["id"] !== "string") {
      return undefined;
    }
    const trigger = parseBlock(raw["trigger"], 0, budget);
    const statements = parseBlockList(raw["statements"], 0, budget);
    if (trigger === undefined || statements === undefined) {
      return undefined;
    }
    const programId = raw["programId"];
    scripts.push({
      id: raw["id"],
      ...(typeof programId === "string" ? { programId } : {}),
      trigger,
      statements,
    });
  }
  return { scripts };
}

function boundedString(value: unknown, min: number, max: number): string | undefined {
  return typeof value === "string" && value.length >= min && value.length <= max
    ? value
    : undefined;
}

function parseEvidence(value: unknown): EvidenceView | undefined {
  if (!isObject(value)) return undefined;
  const { stepsUsed, reachedGoal, outcome } = value;
  return isIndex(stepsUsed) &&
    typeof reachedGoal === "boolean" &&
    (outcome === "completed" || outcome === "budget-exceeded" || outcome === "stopped")
    ? { stepsUsed, reachedGoal, outcome }
    : undefined;
}

const OP_KINDS = ["add", "replace", "remove", "setField"] as const;
const EDIT_FIELDS = ["steps", "degrees", "count"] as const;
const HINT_ACTIONS = ["explain", "debug", "challenge", "propose"] as const;

function parseOperations(value: unknown): OperationView[] | undefined {
  if (!Array.isArray(value) || value.length > 50) return undefined;
  const out: OperationView[] = [];
  for (const raw of value) {
    if (!isObject(raw) || !isIndex(raw["index"])) return undefined;
    const kind = raw["kind"];
    const label = boundedString(raw["label"], 1, 120);
    if (!(OP_KINDS as readonly unknown[]).includes(kind) || label === undefined) return undefined;
    const blockId =
      raw["blockId"] === undefined ? undefined : boundedString(raw["blockId"], 1, 128);
    if (raw["blockId"] !== undefined && blockId === undefined) return undefined;
    let editable: OperationView["editable"];
    if (raw["editable"] !== undefined) {
      const e = raw["editable"];
      if (
        !isObject(e) ||
        !(EDIT_FIELDS as readonly unknown[]).includes(e["field"]) ||
        typeof e["value"] !== "number" ||
        !Number.isInteger(e["value"])
      ) {
        return undefined;
      }
      editable = { field: e["field"] as (typeof EDIT_FIELDS)[number], value: e["value"] };
    }
    out.push({
      index: raw["index"],
      kind: kind as (typeof OP_KINDS)[number],
      label,
      ...(blockId === undefined ? {} : { blockId }),
      ...(editable === undefined ? {} : { editable }),
    });
  }
  return out;
}

function parseAlternatives(value: unknown): AlternativeView[] | undefined {
  if (!Array.isArray(value) || value.length > 3) return undefined;
  const out: AlternativeView[] = [];
  for (const raw of value) {
    if (!isObject(raw) || !isSafeId(raw["proposalId"])) return undefined;
    const purpose = boundedString(raw["purpose"], 1, 300);
    const tradeoff = boundedString(raw["tradeoff"], 1, 300);
    const evidence = parseEvidence(raw["evidence"]);
    if (purpose === undefined || tradeoff === undefined || evidence === undefined) return undefined;
    out.push({ proposalId: raw["proposalId"], purpose, tradeoff, evidence });
  }
  return out;
}

function parseAmbientHint(value: unknown): AmbientHintView | undefined {
  if (!isObject(value)) return undefined;
  const label = boundedString(value["label"], 1, 160);
  const blockId =
    value["blockId"] === undefined ? undefined : boundedString(value["blockId"], 1, 128);
  const actions = value["actions"];
  if (
    label === undefined ||
    (value["blockId"] !== undefined && blockId === undefined) ||
    !Array.isArray(actions) ||
    actions.length < 1 ||
    actions.length > 4 ||
    !actions.every((action) => (HINT_ACTIONS as readonly unknown[]).includes(action))
  ) {
    return undefined;
  }
  return {
    label,
    actions: [...actions] as AmbientHintView["actions"],
    ...(blockId === undefined ? {} : { blockId }),
  };
}

function parseSelection(value: unknown): SelectionInput | undefined {
  if (!isObject(value) || !Array.isArray(value["include"]) || value["include"].length > 50) {
    return undefined;
  }
  const include = value["include"];
  if (!include.every(isIndex)) return undefined;
  let overrides: { index: number; value: number }[] | undefined;
  if (value["overrides"] !== undefined) {
    const raw = value["overrides"];
    if (!Array.isArray(raw) || raw.length > 50) return undefined;
    overrides = [];
    for (const item of raw) {
      if (
        !isObject(item) ||
        !isIndex(item["index"]) ||
        typeof item["value"] !== "number" ||
        !Number.isInteger(item["value"]) ||
        Math.abs(item["value"]) > 100_000
      ) {
        return undefined;
      }
      overrides.push({ index: item["index"], value: item["value"] });
    }
  }
  return { include, ...(overrides === undefined ? {} : { overrides }) };
}

function parseGhostChanges(value: unknown): GhostChange[] | undefined {
  if (!Array.isArray(value) || value.length > 50) {
    return undefined;
  }
  const out: GhostChange[] = [];
  for (const raw of value) {
    if (!isObject(raw)) return undefined;
    const kind = raw["kind"];
    if (kind !== "added" && kind !== "changed" && kind !== "removed" && kind !== "referenced") {
      return undefined;
    }
    const blockId =
      raw["blockId"] === undefined ? undefined : boundedString(raw["blockId"], 1, 128);
    const afterText =
      raw["afterText"] === undefined ? undefined : boundedString(raw["afterText"], 0, 200);
    if (
      (raw["blockId"] !== undefined && blockId === undefined) ||
      (raw["afterText"] !== undefined && afterText === undefined)
    ) {
      return undefined;
    }
    out.push({
      kind,
      ...(blockId === undefined ? {} : { blockId }),
      ...(afterText === undefined ? {} : { afterText }),
    });
  }
  return out;
}

function parseTasks(value: unknown): AgentTask[] | undefined {
  if (!Array.isArray(value) || value.length > 8) return undefined;
  const out: AgentTask[] = [];
  for (const raw of value) {
    if (!isObject(raw)) return undefined;
    const title = boundedString(raw["title"], 1, 120);
    if (!(AGENT_TASK_IDS as readonly unknown[]).includes(raw["id"]) || title === undefined) {
      return undefined;
    }
    out.push({ id: raw["id"] as AgentTask["id"], title });
  }
  return out;
}

function parseAgentMessageFromHost(value: Obj, schema: Schema): HostMessage | undefined {
  switch (value["type"]) {
    case "plan": {
      const tasks = parseTasks(value["tasks"]);
      return tasks === undefined ? undefined : { schema, type: "plan", tasks };
    }
    case "clarify": {
      const options = parseTasks(value["options"]);
      return options === undefined || options.length < 2
        ? undefined
        : { schema, type: "clarify", options };
    }
    case "proposal": {
      const purpose = boundedString(value["purpose"], 1, 300);
      const rationale = boundedString(value["rationale"], 1, 300);
      const changes = parseGhostChanges(value["changes"]);
      if (
        !isSafeId(value["proposalId"]) ||
        purpose === undefined ||
        rationale === undefined ||
        changes === undefined
      ) {
        return undefined;
      }
      const operations =
        value["operations"] === undefined ? undefined : parseOperations(value["operations"]);
      const origin = value["origin"];
      const notice =
        value["notice"] === undefined ? undefined : boundedString(value["notice"], 1, 300);
      if (
        (origin !== undefined && origin !== "provider" && origin !== "built-in") ||
        (value["notice"] !== undefined && notice === undefined)
      ) {
        return undefined;
      }
      const evidence =
        value["evidence"] === undefined ? undefined : parseEvidence(value["evidence"]);
      const alternatives =
        value["alternatives"] === undefined ? undefined : parseAlternatives(value["alternatives"]);
      if (
        (value["operations"] !== undefined && operations === undefined) ||
        (value["evidence"] !== undefined && evidence === undefined) ||
        (value["alternatives"] !== undefined && alternatives === undefined)
      ) {
        return undefined;
      }
      return {
        schema,
        type: "proposal",
        proposalId: value["proposalId"],
        purpose,
        rationale,
        changes,
        ...(operations === undefined ? {} : { operations }),
        ...(evidence === undefined ? {} : { evidence }),
        ...(alternatives === undefined ? {} : { alternatives }),
        ...(origin === undefined ? {} : { origin }),
        ...(notice === undefined ? {} : { notice }),
      };
    }
    case "selectionEvidence": {
      const result = value["result"];
      if (!isSafeId(value["proposalId"]) || !isObject(result)) return undefined;
      if (result["ok"] === true) {
        const evidence = parseEvidence(result["evidence"]);
        return evidence === undefined
          ? undefined
          : {
              schema,
              type: "selectionEvidence",
              proposalId: value["proposalId"],
              result: { ok: true, evidence },
            };
      }
      const reason = result["reason"];
      return result["ok"] === false &&
        (reason === "EMPTY" || reason === "INVALID" || reason === "STALE")
        ? {
            schema,
            type: "selectionEvidence",
            proposalId: value["proposalId"],
            result: { ok: false, reason },
          }
        : undefined;
    }
    case "proposalCleared":
      return { schema, type: "proposalCleared" };
    case "prediction": {
      const options = value["options"];
      return value["questionId"] === "reaches-goal" &&
        Array.isArray(options) &&
        options.length > 0 &&
        options.length <= 2 &&
        options.every((option) => option === "yes" || option === "no")
        ? {
            schema,
            type: "prediction",
            questionId: "reaches-goal",
            options: [...options] as PredictionAnswer[],
          }
        : undefined;
    }
    case "comparison": {
      const predicted = value["predicted"];
      const result = value["result"];
      const steps = value["stepsUsed"];
      return (predicted === "yes" || predicted === "no" || predicted === "skipped") &&
        typeof value["reachedGoal"] === "boolean" &&
        (result === "matched" || result === "mismatched" || result === "skipped") &&
        typeof steps === "number" &&
        Number.isInteger(steps) &&
        steps >= 0 &&
        steps <= 1_000_000
        ? {
            schema,
            type: "comparison",
            predicted,
            reachedGoal: value["reachedGoal"],
            result,
            stepsUsed: steps,
          }
        : undefined;
    }
    case "explainPrompt": {
      const options = value["options"];
      return Array.isArray(options) &&
        options.length >= 1 &&
        options.length <= 4 &&
        options.every((option) => (CONCEPT_IDS as readonly unknown[]).includes(option))
        ? { schema, type: "explainPrompt", options: [...options] as ConceptId[] }
        : undefined;
    }
    case "explainFeedback":
      return value["result"] === "relevant" || value["result"] === "other"
        ? { schema, type: "explainFeedback", result: value["result"] }
        : undefined;
    case "agreements": {
      const agreements = parseAgreements(value["agreements"]);
      return agreements === undefined ? undefined : { schema, type: "agreements", agreements };
    }
    default:
      return undefined;
  }
}

export function parseUiMessage(value: unknown): UiMessage | undefined {
  if (!isObject(value) || value["schema"] !== STUDIO_PROTOCOL_VERSION) {
    return undefined;
  }
  const schema = STUDIO_PROTOCOL_VERSION;
  switch (value["type"]) {
    case "ready":
      return { schema, type: "ready" };
    case "intent": {
      const intent = parseIntent(value["intent"]);
      if (intent === undefined) return undefined;
      const baseHash = value["baseHash"];
      if (baseHash === undefined) return { schema, type: "intent", intent };
      return typeof baseHash === "string" && HASH_PATTERN.test(baseHash)
        ? { schema, type: "intent", intent, baseHash }
        : undefined;
    }
    case "agreementsChanged": {
      const agreements = parseAgreements(value["agreements"]);
      return agreements === undefined
        ? undefined
        : { schema, type: "agreementsChanged", agreements };
    }
    case "decideProposal": {
      const decision = value["decision"];
      if (!isSafeId(value["proposalId"]) || !(DECISIONS as readonly unknown[]).includes(decision)) {
        return undefined;
      }
      const selection =
        value["selection"] === undefined ? undefined : parseSelection(value["selection"]);
      if (value["selection"] !== undefined && selection === undefined) return undefined;
      return {
        schema,
        type: "decideProposal",
        proposalId: value["proposalId"],
        decision: decision as Decision,
        ...(selection === undefined ? {} : { selection }),
      };
    }
    case "chooseAlternative":
      return isSafeId(value["proposalId"])
        ? { schema, type: "chooseAlternative", proposalId: value["proposalId"] }
        : undefined;
    case "previewSelection": {
      const selection = parseSelection(value["selection"]);
      return isSafeId(value["proposalId"]) && selection !== undefined
        ? { schema, type: "previewSelection", proposalId: value["proposalId"], selection }
        : undefined;
    }
    case "stateIntent": {
      const text = normalizeIntent(value["text"]);
      return text === undefined ? undefined : { schema, type: "stateIntent", text };
    }
    case "acceptPlan":
      return { schema, type: "acceptPlan" };
    case "answerClarification":
      return (AGENT_TASK_IDS as readonly unknown[]).includes(value["taskId"])
        ? { schema, type: "answerClarification", taskId: value["taskId"] as AgentTaskId }
        : undefined;
    case "requestProposal":
      return { schema, type: "requestProposal" };
    case "predict":
      return value["answer"] === "yes" || value["answer"] === "no"
        ? { schema, type: "predict", answer: value["answer"] }
        : undefined;
    case "skipPrediction":
      return { schema, type: "skipPrediction" };
    case "run":
      return { schema, type: "run" };
    case "continue":
      return { schema, type: "continue" };
    case "explain":
      return (CONCEPT_IDS as readonly unknown[]).includes(value["concept"])
        ? { schema, type: "explain", concept: value["concept"] as ConceptId }
        : undefined;
    case "skipExplain":
      return { schema, type: "skipExplain" };
    default:
      return undefined;
  }
}

export function parseHostMessage(value: unknown): HostMessage | undefined {
  if (!isObject(value) || value["schema"] !== STUDIO_PROTOCOL_VERSION) {
    return undefined;
  }
  const schema = STUDIO_PROTOCOL_VERSION;
  switch (value["type"]) {
    case "workflow": {
      const state = parseWorkflowState(value["state"]);
      return state === undefined ? undefined : { schema, type: "workflow", state };
    }
    case "programHash":
      return isSafeId(value["hash"])
        ? { schema, type: "programHash", hash: value["hash"] }
        : undefined;
    case "agentUnavailable":
      return { schema, type: "agentUnavailable" };
    case "workspace": {
      const workspace = parseWorkspace(value["workspace"]);
      const hash = value["programHash"];
      return workspace !== undefined && typeof hash === "string" && HASH_PATTERN.test(hash)
        ? { schema, type: "workspace", workspace, programHash: hash }
        : undefined;
    }
    case "error": {
      if (
        value["code"] !== "INVALID_CHANGE" &&
        value["code"] !== "INVALID_PROGRAM" &&
        value["code"] !== "STALE_PROPOSAL" &&
        value["code"] !== "STALE_EDIT" &&
        value["code"] !== "STALE_PLAN" &&
        value["code"] !== "PREDICTION_REQUIRED"
      ) {
        return undefined;
      }
      const reason = value["reason"];
      if (reason === undefined) return { schema, type: "error", code: value["code"] };
      return value["code"] === "INVALID_CHANGE" &&
        (REFUSAL_REASONS as readonly unknown[]).includes(reason)
        ? { schema, type: "error", code: "INVALID_CHANGE", reason: reason as ChangeRefusalReason }
        : undefined;
    }
    case "help": {
      const ceiling = value["ceiling"];
      const blockIds = value["blockIds"];
      if (
        !(HELP_SHOWN as readonly unknown[]).includes(value["kind"]) ||
        typeof ceiling !== "number" ||
        !Number.isInteger(ceiling) ||
        ceiling < 0 ||
        ceiling > 5 ||
        !(AGENT_TASK_IDS as readonly unknown[]).includes(value["taskId"]) ||
        (value["concept"] !== undefined &&
          !(CONCEPT_IDS as readonly unknown[]).includes(value["concept"])) ||
        (blockIds !== undefined &&
          (!Array.isArray(blockIds) || blockIds.length > 50 || !blockIds.every(isSafeId)))
      ) {
        return undefined;
      }
      return {
        schema,
        type: "help",
        kind: value["kind"] as HelpShown,
        ceiling,
        taskId: value["taskId"] as AgentTaskId,
        ...(value["concept"] === undefined ? {} : { concept: value["concept"] as ConceptId }),
        ...(blockIds === undefined ? {} : { blockIds: [...blockIds] as string[] }),
      };
    }
    case "density":
      return (value["value"] === "comfortable" || value["value"] === "compact") &&
        (value["reason"] === "auto" || value["reason"] === "setting")
        ? { schema, type: "density", value: value["value"], reason: value["reason"] }
        : undefined;
    case "sync": {
      const out: { selectedBlockId?: string; executingBlockId?: string; failedBlockId?: string } =
        {};
      for (const key of ["selectedBlockId", "executingBlockId", "failedBlockId"] as const) {
        const raw = value[key];
        if (raw === undefined) continue;
        if (!isSafeId(raw)) return undefined;
        out[key] = raw;
      }
      return { schema, type: "sync", ...out };
    }
    case "ambientHint": {
      if (value["hint"] === undefined) return { schema, type: "ambientHint" };
      const hint = parseAmbientHint(value["hint"]);
      return hint === undefined ? undefined : { schema, type: "ambientHint", hint };
    }
    default:
      return parseAgentMessageFromHost(value, schema);
  }
}
