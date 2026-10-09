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
export const MISSION_SPEC_GOAL_MAX_LENGTH = 140;
export const MISSION_SPEC_PREDICTION_PROMPT_MAX_LENGTH = 160;
export const MISSION_SPEC_SUCCESS_CHECKS = ["touches-goal"] as const;

export interface ExperienceFacts {
  /** Successful learner edits on the canvas this session. */
  readonly edits: number;
  /** The program has reached the goal in the deterministic runtime at least once this session. */
  readonly reachedGoal: boolean;
}

export type MissionSpecSuccessCheck = (typeof MISSION_SPEC_SUCCESS_CHECKS)[number];

export interface MissionSpecView {
  readonly goal: string;
  readonly successCheck: MissionSpecSuccessCheck;
  readonly predictionPrompt?: string;
  readonly hash: string;
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
export type ExecutionCommand = "run" | "step" | "stop" | "reset";
const EXECUTION_COMMANDS: readonly ExecutionCommand[] = ["run", "step", "stop", "reset"];
const MAX_ACTOR_SIZE = 400;

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
      readonly type: "executionCommand";
      readonly command: ExecutionCommand;
    }
  | {
      readonly schema: Schema;
      readonly type: "updateActor";
      readonly actorId: string;
      readonly patch: ActorPatch;
    }
  | {
      readonly schema: Schema;
      readonly type: "updateMissionSpec";
      readonly spec: Omit<MissionSpecView, "hash">;
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

export interface ExecutionEventTraceView {
  readonly id: string;
  readonly step: number;
  readonly actorId: string;
  readonly scriptId: string;
  readonly reason: string;
  readonly event: string;
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

export type ExpectedEvidenceOutcome =
  "completes" | "reaches-goal" | "does-not-reach-goal" | "runtime-error";

export interface ExpectedRuntimeEvidenceView {
  readonly id: string;
  readonly description: string;
  readonly nodeIds?: readonly string[];
  readonly actorIds?: readonly string[];
  readonly scriptIds?: readonly string[];
  readonly assetIds?: readonly string[];
  readonly variableIds?: readonly string[];
  readonly outcome?: ExpectedEvidenceOutcome;
}

export interface AmbientHintView {
  readonly label: string;
  readonly blockId?: string;
  readonly actions: readonly ("explain" | "debug" | "challenge" | "propose")[];
}

export interface HelpView {
  readonly kind: HelpShown;
  readonly ceiling: number;
  readonly taskId: AgentTaskId;
  readonly concept?: ConceptId;
  readonly blockIds?: readonly string[];
}

export interface StagePointView {
  readonly x: number;
  readonly y: number;
}

export interface StageSpriteView extends StagePointView {
  readonly heading: number;
  readonly radius: number;
}

export interface StageGoalView extends StagePointView {
  readonly radius: number;
}

export interface StageViewportView {
  readonly width: number;
  readonly height: number;
}

export interface StageVariableWatcherView {
  readonly id: string;
  readonly label: string;
  readonly value: number;
  readonly visible: boolean;
}

export interface StageSoundStateView {
  readonly activeSoundIds: readonly string[];
}

export interface StageFrameView {
  readonly state: {
    readonly sprite: StageSpriteView;
    readonly goal: StageGoalView;
    readonly viewport: StageViewportView;
    readonly actors?: readonly ActorView[];
    readonly variables?: readonly StageVariableWatcherView[];
    readonly sounds?: StageSoundStateView;
    readonly backdropId?: string;
  };
  readonly frameIndex: number;
  readonly frameCount: number;
  readonly step: number;
  readonly running: boolean;
  readonly reachedGoal: boolean;
  readonly actorId?: string;
  readonly scriptId?: string;
  readonly statementType?: string;
  readonly highlightedNodeId?: string;
}

export interface ActorView {
  readonly id: string;
  readonly name: string;
  readonly x: number;
  readonly y: number;
  readonly direction: number;
  readonly size: number;
  readonly visible: boolean;
  readonly costumeId?: string;
  readonly bubble?: {
    readonly kind: "say" | "think";
    readonly text: string;
  };
  readonly scriptCount?: number;
  /** @deprecated use costumeId. Accepted only for old hosts. */
  readonly appearanceId?: string;
}

export type ActorPatch = Partial<Omit<ActorView, "id" | "scriptCount">>;

export type AssetKind = "sprite" | "backdrop" | "costume" | "sound";

export interface AssetView {
  readonly id: string;
  readonly name: string;
  readonly kind: AssetKind;
  readonly tags: readonly string[];
  readonly width?: number;
  readonly height?: number;
  readonly durationMs?: number;
  readonly preview?: string;
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
      readonly affectedActorIds?: readonly string[];
      readonly affectedScriptIds?: readonly string[];
      readonly affectedAssetIds?: readonly string[];
      readonly affectedVariableIds?: readonly string[];
      readonly affectedNodeIds?: readonly string[];
      readonly expectedRuntimeEvidence?: readonly ExpectedRuntimeEvidenceView[];
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
  | ({ readonly schema: Schema; readonly type: "help" } & HelpView)
  | {
      readonly schema: Schema;
      readonly type: "density";
      readonly value: Density;
      readonly reason: "auto" | "setting";
    }
  | {
      readonly schema: Schema;
      readonly type: "executionState";
      readonly status: "idle" | "running" | "stopped" | "completed";
      readonly outcome: EvidenceView["outcome"];
      readonly frameIndex: number;
      readonly frameCount: number;
      readonly stepsUsed: number;
      readonly eventTrace?: readonly ExecutionEventTraceView[];
    }
  | {
      readonly schema: Schema;
      readonly type: "stageFrame";
      readonly frame: StageFrameView;
    }
  | {
      readonly schema: Schema;
      readonly type: "actors";
      readonly actors: readonly ActorView[];
      readonly selectedActorId?: string;
    }
  | {
      readonly schema: Schema;
      readonly type: "assets";
      readonly assets: readonly AssetView[];
    }
  | {
      readonly schema: Schema;
      readonly type: "missionSpec";
      readonly spec: MissionSpecView;
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
const ASSET_KINDS: readonly AssetKind[] = ["sprite", "backdrop", "costume", "sound"];
const BLOCK_TYPES = [
  "event_on_start",
  "event_green_flag",
  "motion_move",
  "motion_turn",
  "looks_say",
  "looks_think",
  "looks_show",
  "looks_hide",
  "looks_set_size",
  "looks_switch_costume",
  "looks_switch_backdrop",
  "sound_play",
  "sound_stop",
  "event_broadcast",
  "control_repeat",
  "control_if",
  "sensing_touching_goal",
  "literal_boolean",
  "literal_number",
] as const;

type Obj = Record<string, unknown>;
type Container = Extract<Intent, { type: "insertBlock" }>["to"]["container"];
type Location = { container: Container; index: number };
const NODE_ID_PATTERN = /^[A-Za-z0-9:_$.[\]/-]{1,200}$/;

function isObject(value: unknown): value is Obj {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIndex(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100_000;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isActorSize(value: unknown): value is number {
  return isFiniteNumber(value) && value > 0 && value <= MAX_ACTOR_SIZE;
}

function parseStagePoint(value: unknown): StagePointView | undefined {
  if (!isObject(value) || !isFiniteNumber(value["x"]) || !isFiniteNumber(value["y"])) {
    return undefined;
  }
  return { x: value["x"], y: value["y"] };
}

function parseStageSprite(value: unknown): StageSpriteView | undefined {
  const point = parseStagePoint(value);
  if (
    point === undefined ||
    !isObject(value) ||
    !isFiniteNumber(value["heading"]) ||
    !isFiniteNumber(value["radius"])
  ) {
    return undefined;
  }
  return { ...point, heading: value["heading"], radius: value["radius"] };
}

function parseStageGoal(value: unknown): StageGoalView | undefined {
  const point = parseStagePoint(value);
  if (point === undefined || !isObject(value) || !isFiniteNumber(value["radius"])) {
    return undefined;
  }
  return { ...point, radius: value["radius"] };
}

function parseStageViewport(value: unknown): StageViewportView | undefined {
  if (
    !isObject(value) ||
    !isFiniteNumber(value["width"]) ||
    !isFiniteNumber(value["height"]) ||
    value["width"] <= 0 ||
    value["height"] <= 0
  ) {
    return undefined;
  }
  return { width: value["width"], height: value["height"] };
}

function parseStageVariableWatcher(value: unknown): StageVariableWatcherView | undefined {
  if (
    !isObject(value) ||
    typeof value["id"] !== "string" ||
    !isSafeId(value["id"]) ||
    typeof value["label"] !== "string" ||
    value["label"].length === 0 ||
    value["label"].length > 40 ||
    !isFiniteNumber(value["value"]) ||
    typeof value["visible"] !== "boolean"
  ) {
    return undefined;
  }
  return {
    id: value["id"],
    label: value["label"],
    value: value["value"],
    visible: value["visible"],
  };
}

function parseStageSoundState(value: unknown): StageSoundStateView | undefined {
  if (!isObject(value) || !Array.isArray(value["activeSoundIds"])) {
    return undefined;
  }
  const activeSoundIds = value["activeSoundIds"];
  if (activeSoundIds.length > 32 || activeSoundIds.some((id) => !isSafeId(id))) {
    return undefined;
  }
  return { activeSoundIds };
}

function parseStageFrame(value: unknown): StageFrameView | undefined {
  if (!isObject(value) || !isObject(value["state"])) return undefined;
  const state = value["state"];
  const sprite = parseStageSprite(state["sprite"]);
  const goal = parseStageGoal(state["goal"]);
  const viewport = parseStageViewport(state["viewport"]);
  const rawActors = state["actors"];
  const rawVariables = state["variables"];
  const rawSounds = state["sounds"];
  const backdropId = state["backdropId"];
  const actors =
    rawActors === undefined
      ? undefined
      : Array.isArray(rawActors) && rawActors.length <= 32
        ? rawActors.map(parseActor)
        : undefined;
  const highlightedNodeId = value["highlightedNodeId"];
  const actorId = value["actorId"];
  const scriptId = value["scriptId"];
  const statementType = value["statementType"];
  const variables =
    rawVariables === undefined
      ? undefined
      : Array.isArray(rawVariables) && rawVariables.length <= 64
        ? rawVariables.map(parseStageVariableWatcher)
        : undefined;
  const sounds = rawSounds === undefined ? undefined : parseStageSoundState(rawSounds);
  if (
    sprite === undefined ||
    goal === undefined ||
    viewport === undefined ||
    (rawActors !== undefined &&
      (actors === undefined || actors.some((actor) => actor === undefined))) ||
    (rawVariables !== undefined &&
      (variables === undefined || variables.some((variable) => variable === undefined))) ||
    (rawSounds !== undefined && sounds === undefined) ||
    (backdropId !== undefined && !isSafeId(backdropId)) ||
    !isIndex(value["frameIndex"]) ||
    !isIndex(value["frameCount"]) ||
    !isIndex(value["step"]) ||
    typeof value["running"] !== "boolean" ||
    typeof value["reachedGoal"] !== "boolean" ||
    (actorId !== undefined && !isSafeId(actorId)) ||
    (scriptId !== undefined && !isSafeId(scriptId)) ||
    (statementType !== undefined &&
      (typeof statementType !== "string" ||
        statementType.length < 1 ||
        statementType.length > 40)) ||
    (highlightedNodeId !== undefined &&
      (typeof highlightedNodeId !== "string" || !NODE_ID_PATTERN.test(highlightedNodeId)))
  ) {
    return undefined;
  }
  return {
    state: {
      sprite,
      goal,
      viewport,
      ...(state["actors"] === undefined ? {} : { actors: actors as ActorView[] }),
      ...(state["variables"] === undefined
        ? {}
        : { variables: variables as StageVariableWatcherView[] }),
      ...(sounds === undefined ? {} : { sounds }),
      ...(backdropId === undefined ? {} : { backdropId }),
    },
    frameIndex: value["frameIndex"],
    frameCount: value["frameCount"],
    step: value["step"],
    running: value["running"],
    reachedGoal: value["reachedGoal"],
    ...(actorId === undefined ? {} : { actorId }),
    ...(scriptId === undefined ? {} : { scriptId }),
    ...(statementType === undefined ? {} : { statementType }),
    ...(highlightedNodeId === undefined ? {} : { highlightedNodeId }),
  };
}

function parseBubble(value: unknown): ActorView["bubble"] | undefined {
  if (!isObject(value)) return undefined;
  const kind = value["kind"];
  const text = value["text"];
  if (
    (kind !== "say" && kind !== "think") ||
    typeof text !== "string" ||
    text.length < 1 ||
    text.length > 140
  ) {
    return undefined;
  }
  return { kind, text };
}

function parseActor(value: unknown): ActorView | undefined {
  const bubble =
    isObject(value) && value["bubble"] !== undefined ? parseBubble(value["bubble"]) : undefined;
  if (
    !isObject(value) ||
    !isSafeId(value["id"]) ||
    typeof value["name"] !== "string" ||
    value["name"].length < 1 ||
    value["name"].length > 80 ||
    !isFiniteNumber(value["x"]) ||
    !isFiniteNumber(value["y"]) ||
    !isFiniteNumber(value["direction"]) ||
    !isActorSize(value["size"]) ||
    typeof value["visible"] !== "boolean" ||
    (value["costumeId"] !== undefined && !isSafeId(value["costumeId"])) ||
    (value["appearanceId"] !== undefined && !isSafeId(value["appearanceId"])) ||
    (value["bubble"] !== undefined && bubble === undefined) ||
    (value["scriptCount"] !== undefined && !isIndex(value["scriptCount"]))
  ) {
    return undefined;
  }
  const costumeId = value["costumeId"] ?? value["appearanceId"];
  return {
    id: value["id"],
    name: value["name"],
    x: value["x"],
    y: value["y"],
    direction: value["direction"],
    size: value["size"],
    visible: value["visible"],
    ...(costumeId === undefined ? {} : { costumeId: costumeId as string }),
    ...(bubble === undefined ? {} : { bubble }),
    ...(value["scriptCount"] === undefined ? {} : { scriptCount: value["scriptCount"] }),
  };
}

function parseActorPatch(value: unknown): ActorPatch | undefined {
  if (!isObject(value)) return undefined;
  const patch: Record<string, unknown> = {};
  for (const [key, raw] of Object.entries(value)) {
    switch (key) {
      case "name":
        if (typeof raw !== "string" || raw.length < 1 || raw.length > 80) return undefined;
        patch.name = raw;
        break;
      case "x":
      case "y":
      case "direction":
        if (!isFiniteNumber(raw)) return undefined;
        patch[key] = raw;
        break;
      case "size":
        if (!isActorSize(raw)) return undefined;
        patch.size = raw;
        break;
      case "visible":
        if (typeof raw !== "boolean") return undefined;
        patch.visible = raw;
        break;
      case "appearanceId":
      case "costumeId":
        if (raw !== undefined && !isSafeId(raw)) return undefined;
        patch.costumeId = raw;
        break;
      default:
        return undefined;
    }
  }
  return patch as ActorPatch;
}

function parseAsset(value: unknown): AssetView | undefined {
  if (
    !isObject(value) ||
    !isSafeId(value["id"]) ||
    typeof value["name"] !== "string" ||
    value["name"].length < 1 ||
    value["name"].length > 120 ||
    !(ASSET_KINDS as readonly unknown[]).includes(value["kind"]) ||
    !Array.isArray(value["tags"]) ||
    value["tags"].length > 16 ||
    !value["tags"].every((tag) => typeof tag === "string" && tag.length <= 40)
  ) {
    return undefined;
  }
  for (const key of ["width", "height", "durationMs"] as const) {
    if (value[key] !== undefined && !isIndex(value[key])) return undefined;
  }
  if (value["preview"] !== undefined && typeof value["preview"] !== "string") return undefined;
  return {
    id: value["id"],
    name: value["name"],
    kind: value["kind"] as AssetKind,
    tags: [...value["tags"]] as string[],
    ...(value["width"] === undefined ? {} : { width: value["width"] as number }),
    ...(value["height"] === undefined ? {} : { height: value["height"] as number }),
    ...(value["durationMs"] === undefined ? {} : { durationMs: value["durationMs"] as number }),
    ...(value["preview"] === undefined ? {} : { preview: value["preview"] }),
  };
}

function parseMissionSpec(value: unknown): Omit<MissionSpecView, "hash"> | undefined {
  if (!isObject(value)) return undefined;
  const goal = boundedPlainText(value["goal"], 1, MISSION_SPEC_GOAL_MAX_LENGTH);
  const successCheck = value["successCheck"];
  const predictionPrompt =
    value["predictionPrompt"] === undefined
      ? undefined
      : boundedPlainText(value["predictionPrompt"], 1, MISSION_SPEC_PREDICTION_PROMPT_MAX_LENGTH);
  if (
    goal === undefined ||
    !MISSION_SPEC_SUCCESS_CHECKS.includes(successCheck as MissionSpecSuccessCheck) ||
    (value["predictionPrompt"] !== undefined && predictionPrompt === undefined)
  ) {
    return undefined;
  }
  return {
    goal,
    successCheck: successCheck as MissionSpecSuccessCheck,
    ...(predictionPrompt === undefined ? {} : { predictionPrompt }),
  };
}

function parseMissionSpecView(value: unknown): MissionSpecView | undefined {
  if (!isObject(value)) return undefined;
  const spec = parseMissionSpec(value);
  const hash = value["hash"];
  return spec !== undefined && typeof hash === "string" && HASH_PATTERN.test(hash)
    ? { ...spec, hash }
    : undefined;
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

function boundedPlainText(value: unknown, min: number, max: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = [...value]
    .map((char) => {
      const code = char.charCodeAt(0);
      return code < 32 || code === 127 ? " " : char;
    })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length < min || normalized.length > max) return undefined;
  return /[<>`]/.test(normalized) || /\bhttps?:\/\//i.test(normalized) ? undefined : normalized;
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

function parseExecutionEventTrace(value: unknown): ExecutionEventTraceView[] | undefined {
  if (!Array.isArray(value) || value.length > 200) return undefined;
  const out: ExecutionEventTraceView[] = [];
  for (const raw of value) {
    if (!isObject(raw) || !isIndex(raw["step"])) return undefined;
    const id = boundedString(raw["id"], 1, 128);
    const actorId = boundedString(raw["actorId"], 1, 128);
    const scriptId = boundedString(raw["scriptId"], 1, 128);
    const reason = boundedString(raw["reason"], 1, 300);
    const event = boundedString(raw["event"], 1, 160);
    if (
      id === undefined ||
      actorId === undefined ||
      scriptId === undefined ||
      reason === undefined ||
      event === undefined
    ) {
      return undefined;
    }
    out.push({ id, step: raw["step"], actorId, scriptId, reason, event });
  }
  return out;
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

function parseIdList(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length > 50) return undefined;
  const out: string[] = [];
  for (const item of value) {
    const parsed = boundedString(item, 1, 160);
    if (parsed === undefined) return undefined;
    out.push(parsed);
  }
  return out;
}

function parseOptionalIdList(value: unknown): readonly string[] | undefined {
  return value === undefined ? undefined : parseIdList(value);
}

function parseExpectedRuntimeEvidence(
  value: unknown,
): readonly ExpectedRuntimeEvidenceView[] | undefined {
  if (!Array.isArray(value) || value.length > 12) return undefined;
  const out: ExpectedRuntimeEvidenceView[] = [];
  for (const raw of value) {
    if (!isObject(raw)) return undefined;
    const id = boundedString(raw["id"], 1, 120);
    const description = boundedString(raw["description"], 1, 400);
    const nodeIds = parseOptionalIdList(raw["nodeIds"]);
    const actorIds = parseOptionalIdList(raw["actorIds"]);
    const scriptIds = parseOptionalIdList(raw["scriptIds"]);
    const assetIds = parseOptionalIdList(raw["assetIds"]);
    const variableIds = parseOptionalIdList(raw["variableIds"]);
    const outcome = raw["outcome"];
    if (
      id === undefined ||
      description === undefined ||
      (raw["nodeIds"] !== undefined && nodeIds === undefined) ||
      (raw["actorIds"] !== undefined && actorIds === undefined) ||
      (raw["scriptIds"] !== undefined && scriptIds === undefined) ||
      (raw["assetIds"] !== undefined && assetIds === undefined) ||
      (raw["variableIds"] !== undefined && variableIds === undefined) ||
      (outcome !== undefined &&
        outcome !== "completes" &&
        outcome !== "reaches-goal" &&
        outcome !== "does-not-reach-goal" &&
        outcome !== "runtime-error")
    ) {
      return undefined;
    }
    out.push({
      id,
      description,
      ...(nodeIds === undefined ? {} : { nodeIds }),
      ...(actorIds === undefined ? {} : { actorIds }),
      ...(scriptIds === undefined ? {} : { scriptIds }),
      ...(assetIds === undefined ? {} : { assetIds }),
      ...(variableIds === undefined ? {} : { variableIds }),
      ...(outcome === undefined ? {} : { outcome: outcome as ExpectedEvidenceOutcome }),
    });
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
      const affectedActorIds = parseOptionalIdList(value["affectedActorIds"]);
      const affectedScriptIds = parseOptionalIdList(value["affectedScriptIds"]);
      const affectedAssetIds = parseOptionalIdList(value["affectedAssetIds"]);
      const affectedVariableIds = parseOptionalIdList(value["affectedVariableIds"]);
      const affectedNodeIds = parseOptionalIdList(value["affectedNodeIds"]);
      const expectedRuntimeEvidence =
        value["expectedRuntimeEvidence"] === undefined
          ? undefined
          : parseExpectedRuntimeEvidence(value["expectedRuntimeEvidence"]);
      const origin = value["origin"];
      const notice =
        value["notice"] === undefined ? undefined : boundedString(value["notice"], 1, 300);
      if (
        (origin !== undefined && origin !== "provider" && origin !== "built-in") ||
        (value["notice"] !== undefined && notice === undefined) ||
        (value["affectedActorIds"] !== undefined && affectedActorIds === undefined) ||
        (value["affectedScriptIds"] !== undefined && affectedScriptIds === undefined) ||
        (value["affectedAssetIds"] !== undefined && affectedAssetIds === undefined) ||
        (value["affectedVariableIds"] !== undefined && affectedVariableIds === undefined) ||
        (value["affectedNodeIds"] !== undefined && affectedNodeIds === undefined) ||
        (value["expectedRuntimeEvidence"] !== undefined && expectedRuntimeEvidence === undefined)
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
        ...(affectedActorIds === undefined ? {} : { affectedActorIds }),
        ...(affectedScriptIds === undefined ? {} : { affectedScriptIds }),
        ...(affectedAssetIds === undefined ? {} : { affectedAssetIds }),
        ...(affectedVariableIds === undefined ? {} : { affectedVariableIds }),
        ...(affectedNodeIds === undefined ? {} : { affectedNodeIds }),
        ...(expectedRuntimeEvidence === undefined ? {} : { expectedRuntimeEvidence }),
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
    case "help": {
      const kind = value["kind"];
      const ceiling = value["ceiling"];
      const taskId = value["taskId"];
      const concept = value["concept"];
      const blockIds = value["blockIds"] === undefined ? undefined : parseIdList(value["blockIds"]);
      if (
        !(HELP_SHOWN as readonly unknown[]).includes(kind) ||
        !isIndex(ceiling) ||
        !(AGENT_TASK_IDS as readonly unknown[]).includes(taskId) ||
        (concept !== undefined && !(CONCEPT_IDS as readonly unknown[]).includes(concept)) ||
        (value["blockIds"] !== undefined && blockIds === undefined)
      ) {
        return undefined;
      }
      return {
        schema,
        type: "help",
        kind: kind as HelpShown,
        ceiling,
        taskId: taskId as AgentTaskId,
        ...(concept === undefined ? {} : { concept: concept as ConceptId }),
        ...(blockIds === undefined ? {} : { blockIds }),
      };
    }
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
    case "executionCommand":
      return (EXECUTION_COMMANDS as readonly unknown[]).includes(value["command"])
        ? { schema, type: "executionCommand", command: value["command"] as ExecutionCommand }
        : undefined;
    case "updateActor": {
      const patch = parseActorPatch(value["patch"]);
      return isSafeId(value["actorId"]) && patch !== undefined
        ? { schema, type: "updateActor", actorId: value["actorId"], patch }
        : undefined;
    }
    case "updateMissionSpec": {
      const spec = parseMissionSpec(value["spec"]);
      return spec === undefined ? undefined : { schema, type: "updateMissionSpec", spec };
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
    case "executionState": {
      const eventTrace =
        value["eventTrace"] === undefined
          ? undefined
          : parseExecutionEventTrace(value["eventTrace"]);
      return (value["status"] === "idle" ||
        value["status"] === "running" ||
        value["status"] === "stopped" ||
        value["status"] === "completed") &&
        (value["outcome"] === "completed" ||
          value["outcome"] === "budget-exceeded" ||
          value["outcome"] === "stopped") &&
        isIndex(value["frameIndex"]) &&
        isIndex(value["frameCount"]) &&
        isIndex(value["stepsUsed"]) &&
        (value["eventTrace"] === undefined || eventTrace !== undefined)
        ? {
            schema,
            type: "executionState",
            status: value["status"],
            outcome: value["outcome"],
            frameIndex: value["frameIndex"],
            frameCount: value["frameCount"],
            stepsUsed: value["stepsUsed"],
            ...(eventTrace === undefined ? {} : { eventTrace }),
          }
        : undefined;
    }
    case "stageFrame": {
      const frame = parseStageFrame(value["frame"]);
      return frame === undefined ? undefined : { schema, type: "stageFrame", frame };
    }
    case "actors": {
      const actors = value["actors"];
      const selectedActorId = value["selectedActorId"];
      if (!Array.isArray(actors) || actors.length > 32) return undefined;
      const parsed = actors.map(parseActor);
      return parsed.every((actor) => actor !== undefined) &&
        (selectedActorId === undefined || isSafeId(selectedActorId))
        ? {
            schema,
            type: "actors",
            actors: parsed as ActorView[],
            ...(selectedActorId === undefined ? {} : { selectedActorId }),
          }
        : undefined;
    }
    case "assets": {
      const assets = value["assets"];
      if (!Array.isArray(assets) || assets.length > 128) return undefined;
      const parsed = assets.map(parseAsset);
      return parsed.every((asset) => asset !== undefined)
        ? { schema, type: "assets", assets: parsed as AssetView[] }
        : undefined;
    }
    case "missionSpec": {
      const spec = parseMissionSpecView(value["spec"]);
      return spec === undefined ? undefined : { schema, type: "missionSpec", spec };
    }
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
    case "density":
      return (value["value"] === "comfortable" || value["value"] === "compact") &&
        (value["reason"] === "auto" || value["reason"] === "setting")
        ? { schema, type: "density", value: value["value"], reason: value["reason"] }
        : undefined;
    default:
      return parseAgentMessageFromHost(value, schema);
  }
}
