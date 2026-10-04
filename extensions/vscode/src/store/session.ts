import type * as vscode from "vscode";
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
  readonly companionTurns: StudioCompanionTurn[];
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
    companionTurns: [],
    undoStack: [],
    redoStack: [],
  };
}

export function clearProjectSession(state: StudioSessionState): void {
  state.executionEvidence = undefined;
  state.executionFrameIndex = 0;
  state.executionStatus = "idle";
  state.activeProposal = undefined;
  state.companionTurns.length = 0;
  state.undoStack.length = 0;
  state.redoStack.length = 0;
}

export function clearStudioSession(state: StudioSessionState): void {
  state.current = undefined;
  clearProjectSession(state);
}
