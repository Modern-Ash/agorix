export const TEAM_PROJECT_PACKAGE_NAME = "@agorix/team-project";
export { TeamSession } from "./session.js";
export {
  DEFAULT_TEAM_POLICY,
  REACTION_IDS,
  TEAM_ROLES,
  TeamError,
  type ChangeOrigin,
  type ChangeStatus,
  type Clock,
  type EditMode,
  type HistoryEntry,
  type PendingChange,
  type ReactionId,
  type ReactionTarget,
  type TeamErrorCode,
  type TeamMember,
  type TeamPolicy,
  type TeamRole,
  type TeamSessionOptions,
  type TeamSnapshot,
} from "./types.js";
export {
  ContentGate,
  GateError,
  NEUTRAL_NOTICE,
  type ContentKind,
  type GateErrorCode,
  type GateOptions,
  type LocalVerdict,
  type QueuedItem,
  type RejectionReason,
  type SubmitResult,
} from "./contentGate.js";
