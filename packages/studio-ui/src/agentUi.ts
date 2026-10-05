import {
  DEFAULT_AGREEMENTS,
  type AgentAgreements,
  type AgentTask,
  type ConceptId,
  type PredictionAnswer,
  type WorkflowState,
} from "@agorix/agent-workflow";
import type {
  AlternativeView,
  EvidenceView,
  GhostChange,
  HostMessage,
  OperationView,
  SelectionInput,
} from "@agorix/studio-protocol";

/** What the learner currently keeps of a proposal: operation indexes and edited values. */
export interface SelectionState {
  readonly include: readonly number[];
  readonly overrides: Readonly<Record<number, number>>;
}

export function fullSelection(operations: readonly OperationView[] | undefined): SelectionState {
  return { include: (operations ?? []).map((operation) => operation.index), overrides: {} };
}

export function selectionInput(selection: SelectionState): SelectionInput {
  const overrides = Object.entries(selection.overrides)
    .filter(([index]) => selection.include.includes(Number(index)))
    .map(([index, value]) => ({ index: Number(index), value }));
  return { include: selection.include, ...(overrides.length === 0 ? {} : { overrides }) };
}

/** Anchored hints and skipped blocks for the canvas, derived from the learner's selection. */
export function canvasHints(
  proposal: AgentUiState["proposal"],
  selection: SelectionState,
): {
  readonly hints: Record<string, string>;
  readonly skipped: string[];
  readonly ghosts: readonly GhostChange[];
} {
  const hints: Record<string, string> = {};
  const skipped: string[] = [];
  const operations = proposal?.operations ?? [];
  for (const operation of operations) {
    if (operation.blockId === undefined) continue;
    hints[operation.blockId] = operation.label;
    if (!selection.include.includes(operation.index)) skipped.push(operation.blockId);
  }
  const keepsAdd = operations.some(
    (operation) => operation.kind === "add" && selection.include.includes(operation.index),
  );
  const ghosts = (proposal?.changes ?? []).filter((change) =>
    change.blockId !== undefined
      ? !skipped.includes(change.blockId)
      : operations.length === 0 || change.kind !== "added" || keepsAdd,
  );
  return { hints, skipped, ghosts };
}

export function toggleOperation(selection: SelectionState, index: number): SelectionState {
  return {
    ...selection,
    include: selection.include.includes(index)
      ? selection.include.filter((item) => item !== index)
      : [...selection.include, index].sort((a, b) => a - b),
  };
}

export function editOperation(
  selection: SelectionState,
  index: number,
  value: number,
): SelectionState {
  return { ...selection, overrides: { ...selection.overrides, [index]: value } };
}

export type ComparisonData = Extract<HostMessage, { type: "comparison" }>;

export type HelpData = Extract<HostMessage, { type: "help" }>;

export interface AgentUiState {
  readonly help?: HelpData;
  readonly workflow?: WorkflowState;
  readonly agreements: AgentAgreements;
  readonly tasks?: readonly AgentTask[];
  readonly clarify?: readonly AgentTask[];
  readonly proposal?: {
    readonly proposalId: string;
    readonly purpose: string;
    readonly rationale: string;
    readonly changes: readonly GhostChange[];
    readonly operations?: readonly OperationView[];
    readonly evidence?: EvidenceView;
    readonly alternatives?: readonly AlternativeView[];
    readonly origin?: "provider" | "built-in";
    readonly notice?: string;
  };
  readonly selectionEvidence?: Extract<HostMessage, { type: "selectionEvidence" }>["result"];
  readonly prediction?: readonly PredictionAnswer[];
  readonly comparison?: ComparisonData;
  readonly explain?: readonly ConceptId[];
  readonly feedback?: "relevant" | "other";
  readonly available: boolean;
  readonly notice?: string;
}

export function initialAgentUi(): AgentUiState {
  return { agreements: DEFAULT_AGREEMENTS, available: true };
}

function without<K extends keyof AgentUiState>(state: AgentUiState, ...keys: K[]): AgentUiState {
  const next: Record<string, unknown> = { ...state };
  for (const key of keys) delete next[key];
  return next as unknown as AgentUiState;
}

export function reduceAgentUi(state: AgentUiState, message: HostMessage): AgentUiState {
  switch (message.type) {
    case "workflow": {
      let next: AgentUiState = { ...state, workflow: message.state };
      const stage = message.state.stage;
      if (stage === "intent") {
        next = without(
          next,
          "tasks",
          "clarify",
          "help",
          "proposal",
          "prediction",
          "comparison",
          "explain",
          "feedback",
        );
      }
      if (stage !== "explain") next = without(next, "explain");
      if (stage !== "compare" && stage !== "explain") next = without(next, "comparison");
      if (stage === "proposal" || stage === "predict") next = without(next, "feedback");
      return next;
    }
    case "plan":
      return { ...without(state, "notice", "clarify"), tasks: message.tasks };
    case "clarify":
      return { ...without(state, "notice", "tasks"), clarify: message.options };
    case "proposal":
      return {
        ...without(state, "notice", "selectionEvidence", "help"),
        proposal: {
          proposalId: message.proposalId,
          purpose: message.purpose,
          rationale: message.rationale,
          changes: message.changes,
          ...(message.operations === undefined ? {} : { operations: message.operations }),
          ...(message.evidence === undefined ? {} : { evidence: message.evidence }),
          ...(message.alternatives === undefined ? {} : { alternatives: message.alternatives }),
          ...(message.origin === undefined ? {} : { origin: message.origin }),
          ...(message.notice === undefined ? {} : { notice: message.notice }),
        },
      };
    case "selectionEvidence":
      return state.proposal?.proposalId === message.proposalId
        ? { ...state, selectionEvidence: message.result }
        : state;
    case "help":
      return { ...without(state, "notice"), help: message };
    case "proposalCleared":
      return without(state, "proposal", "prediction", "selectionEvidence");
    case "prediction":
      return { ...state, prediction: message.options };
    case "comparison":
      return { ...without(state, "prediction"), comparison: message };
    case "explainPrompt":
      return { ...state, explain: message.options };
    case "explainFeedback":
      return { ...without(state, "explain"), feedback: message.result };
    case "agreements":
      return {
        ...(message.agreements.aiEnabled ? without(state, "notice") : state),
        agreements: message.agreements,
        available: message.agreements.aiEnabled,
      };
    case "agentUnavailable":
      return {
        ...state,
        available: false,
        notice: "The agent is off right now. Everything else still works.",
      };
    case "error":
      if (message.code === "PREDICTION_REQUIRED") {
        return { ...state, notice: "Make a prediction first, then accept the suggestion." };
      }
      if (message.code === "STALE_PLAN") {
        return {
          ...without(state, "tasks", "clarify"),
          notice: "The program changed, so the plan was dropped. Nothing was applied.",
        };
      }
      return message.code === "STALE_PROPOSAL"
        ? {
            ...state,
            notice: "The program changed, so that suggestion was dropped. Nothing was applied.",
          }
        : state;
    default:
      return state;
  }
}
