/** Platform-neutral Director/Auditor workflow and assistance policy. No DOM, VS Code or provider code. */
export const PACKAGE_NAME = "@agorix/agent-workflow";

export type {
  AdvanceResult,
  AgentAction,
  WorkflowEvent,
  WorkflowMode,
  WorkflowStage,
  WorkflowState,
} from "./loop.js";
export { advance, createWorkflow, nextAgentAction } from "./loop.js";
export type { AgentAgreements, AssistanceLevel, OfferableSignal } from "./assistance.js";
export {
  DEFAULT_AGREEMENTS,
  canOffer,
  deescalate,
  effectiveAssistance,
  nextAssistanceLevel,
} from "./assistance.js";
export type { AgentTask, AgentTaskId } from "./plan.js";
export {
  AGENT_TASK_IDS,
  MAX_INTENT_LENGTH,
  needsClarification,
  normalizeIntent,
  planTasks,
  taskForId,
} from "./plan.js";
export type { PredictionAnswer, PredictionResult } from "./predict.js";
export { comparePrediction } from "./predict.js";
export type { ConceptId } from "./explain.js";
export { CONCEPT_IDS, checkExplanation, relevantConcept } from "./explain.js";
export type { AgentEvent, AgentEventType } from "./events.js";
export { MAX_AGENT_EVENTS } from "./events.js";

export type { CompanionActionName, HelpKind } from "./help.js";
export {
  COMPANION_ACTION_HELP,
  HELP_KIND_LEVEL,
  canShowHelp,
  canUseCompanionAction,
  highestHelpKind,
} from "./help.js";
