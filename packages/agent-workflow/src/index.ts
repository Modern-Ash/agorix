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
