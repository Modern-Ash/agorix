import type {
  AgentAgreements,
  AssistanceLevel,
  OfferableSignal,
  WorkflowMode,
  WorkflowStage,
  WorkflowState,
} from "@agorix/agent-workflow";
import { isSafeId, parseAnchorRef, type Intent } from "@agorix/interaction-core";

/** Versioned host <-> UI messages. UIs send intents; the host owns canonical mutation. */
export const STUDIO_PROTOCOL_VERSION = "agorix/studio-protocol/v1";
export const PACKAGE_NAME = "@agorix/studio-protocol";

type Schema = typeof STUDIO_PROTOCOL_VERSION;
type Decision = "accepted" | "rejected" | "modified";

export type UiMessage =
  | { readonly schema: Schema; readonly type: "ready" }
  | { readonly schema: Schema; readonly type: "intent"; readonly intent: Intent }
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
    };

export type HostMessage =
  | { readonly schema: Schema; readonly type: "workflow"; readonly state: WorkflowState }
  | { readonly schema: Schema; readonly type: "programHash"; readonly hash: string }
  | { readonly schema: Schema; readonly type: "agentUnavailable" };

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
      return intent === undefined ? undefined : { schema, type: "intent", intent };
    }
    case "agreementsChanged": {
      const agreements = parseAgreements(value["agreements"]);
      return agreements === undefined
        ? undefined
        : { schema, type: "agreementsChanged", agreements };
    }
    case "decideProposal": {
      const decision = value["decision"];
      return isSafeId(value["proposalId"]) && (DECISIONS as readonly unknown[]).includes(decision)
        ? {
            schema,
            type: "decideProposal",
            proposalId: value["proposalId"],
            decision: decision as Decision,
          }
        : undefined;
    }
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
    default:
      return undefined;
  }
}
