import type { AgentEvent } from "@agorix/agent-workflow";
import type * as vscode from "vscode";
import { DEFAULT_AGREEMENTS, type AgentAgreements } from "@agorix/agent-workflow";
import type {
  StudioCompanionTurn,
  StudioExecutionEvidence,
  StudioExecutionStatus,
  StudioProposalSession,
  StudioProject,
  StudioProjectionId,
  StudioRemoteProjectPayload,
  StudioRemoteProjectReference,
  StudioRemoteSaveResult,
} from "../studioCore.js";

export const PROJECTION_SCHEME = "agorix-studio";
export const REMOTE_SCHEME = "agorix-remote";
export const SECRET_TOKEN_KEY = "agorixStudio.accountToken";
export const SECRET_AGENT_CREDENTIAL_KEY = "agorixStudio.agentCredential";

export interface OpenProject {
  readonly uri: vscode.Uri;
  readonly project: StudioProject;
  readonly remote?: OpenRemoteProject;
}

export interface OpenRemoteProject {
  readonly id: string;
  readonly title: string;
  readonly revision: string;
}

export interface StudioRemoteClient {
  listProjects(): Promise<StudioRemoteProjectReference[]>;
  getProject(id: string): Promise<StudioRemoteProjectPayload>;
  saveProject(request: {
    readonly id: string;
    readonly expectedRevision: string;
    readonly project: StudioProject["stored"];
  }): Promise<StudioRemoteSaveResult>;
}

export interface StoredSnapshot {
  readonly uri: vscode.Uri;
  readonly raw: string;
}

export interface StudioSessionState {
  current: OpenProject | undefined;
  currentProjectionId: StudioProjectionId;
  executionEvidence: StudioExecutionEvidence | undefined;
  executionFrameIndex: number;
  executionStatus: StudioExecutionStatus;
  activeProposal: StudioProposalSession | undefined;
  agentAgreements: AgentAgreements;
  ambientOffersUsed: number;
  ambientBudgetCapped: boolean;
  ambientOfferStats: {
    shown: number;
    accepted: number;
    dismissed: number;
    ignored: number;
  };
  readonly companionTurns: StudioCompanionTurn[];
  readonly agentEvents: AgentEvent[];
  readonly undoStack: StoredSnapshot[];
  readonly redoStack: StoredSnapshot[];
}

export function createStudioSessionState(): StudioSessionState {
  return {
    current: undefined,
    currentProjectionId: "typescript",
    executionEvidence: undefined,
    executionFrameIndex: 0,
    executionStatus: "idle",
    activeProposal: undefined,
    agentAgreements: DEFAULT_AGREEMENTS,
    ambientOffersUsed: 0,
    ambientBudgetCapped: false,
    ambientOfferStats: { shown: 0, accepted: 0, dismissed: 0, ignored: 0 },
    companionTurns: [],
    agentEvents: [],
    undoStack: [],
    redoStack: [],
  };
}

export function clearProjectSession(state: StudioSessionState): void {
  state.executionEvidence = undefined;
  state.executionFrameIndex = 0;
  state.executionStatus = "idle";
  state.activeProposal = undefined;
  state.agentAgreements = DEFAULT_AGREEMENTS;
  state.ambientOffersUsed = 0;
  state.ambientBudgetCapped = false;
  state.ambientOfferStats = { shown: 0, accepted: 0, dismissed: 0, ignored: 0 };
  state.companionTurns.length = 0;
  state.agentEvents.length = 0;
  state.undoStack.length = 0;
  state.redoStack.length = 0;
}

export function clearStudioSession(state: StudioSessionState): void {
  state.current = undefined;
  clearProjectSession(state);
}
