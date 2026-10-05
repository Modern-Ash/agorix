import type { AssistanceLevel } from "./assistance.js";
import type { AgentTaskId } from "./plan.js";

export type AgentEventType =
  | "proposalRequested"
  | "proposalAccepted"
  | "proposalRejected"
  | "proposalModified"
  | "alternativeChosen"
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
  /** Where the proposal came from; an enum, never provider or model identity. */
  readonly origin?: "provider" | "built-in";
}

export const MAX_AGENT_EVENTS = 200;
