import {
  DEFAULT_AGREEMENTS,
  type AgentAgreements,
  type AgentTask,
  type ConceptId,
  type PredictionAnswer,
  type WorkflowState,
} from "@agorix/agent-workflow";
import type { GhostChange, HostMessage } from "@agorix/studio-protocol";

export type ComparisonData = Extract<HostMessage, { type: "comparison" }>;

export interface AgentUiState {
  readonly workflow?: WorkflowState;
  readonly agreements: AgentAgreements;
  readonly tasks?: readonly AgentTask[];
  readonly clarify?: readonly AgentTask[];
  readonly proposal?: {
    readonly proposalId: string;
    readonly purpose: string;
    readonly rationale: string;
    readonly changes: readonly GhostChange[];
  };
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
        ...without(state, "notice"),
        proposal: {
          proposalId: message.proposalId,
          purpose: message.purpose,
          rationale: message.rationale,
          changes: message.changes,
        },
      };
    case "proposalCleared":
      return without(state, "proposal", "prediction");
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
