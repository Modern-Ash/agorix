import * as vscode from "vscode";
import {
  createStudioAccountCommandHandlers,
  refreshAgentStatus,
  createAgentClient,
} from "./commands/accounts.js";
import { createStudioCompanionCommandHandlers } from "./commands/companion.js";
import { createStudioDeveloperCommandHandlers } from "./commands/developer.js";
import { createStudioExecutionCommandHandlers } from "./commands/execution.js";
import { createStudioProjectionCommandHandlers } from "./commands/projections.js";
import { createStudioProjectCommandHandlers } from "./commands/projects.js";
import { createStudioProposalCommandHandlers } from "./commands/proposals.js";
import { createStudioSurfaceCommandHandlers } from "./commands/surfaces.js";
import { reportFailure } from "./commands/guarded.js";
import { registerStudioCommands } from "./commands/register.js";
import { clearStudioSession, createStudioSessionState } from "./store/session.js";
import {
  afterCanonicalProgramChange as applyCanonicalProgramChange,
  requireProject as requireProjectFromState,
  resetProjectSessionState as resetSessionProjectState,
  updateStudioContext as updateContextFromState,
} from "./store/lifecycle.js";
import { disposeWorkbench } from "./host/workbenchPanel.js";
import { disposeWorldPreview } from "./host/worldPreviewPanel.js";
import { registerStudioViews } from "./views/register.js";

const session = createStudioSessionState();

function resetProjectSessionState(): void {
  resetSessionProjectState(session);
}

function updateStudioContext(): void {
  updateContextFromState(session);
}

function requireProject() {
  return requireProjectFromState(session);
}

export { createAgentClient };

export function activate(context: vscode.ExtensionContext): void {
  let refreshStudioViews: () => void = () => undefined;
  let refreshExecutionViews: () => void = () => undefined;
  let refreshCompanionViews: () => void = () => undefined;
  const afterCanonicalProgramChange = (): void => {
    applyCanonicalProgramChange(session, {
      refreshStudioViews,
      refreshExecutionViews,
      refreshCompanionViews,
    });
  };

  const output = vscode.window.createOutputChannel("Agorix Studio");
  context.subscriptions.push(output);
  const agentStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 0);
  agentStatusItem.command = "agorixStudio.checkAgentHealth";
  context.subscriptions.push(agentStatusItem);
  const projectionCommands = createStudioProjectionCommandHandlers({
    requireProject,
    getCurrentProject: () => session.current,
    getCurrentProjectionId: () => session.currentProjectionId,
    setCurrentProjectionId: (id) => {
      session.currentProjectionId = id;
    },
  });
  const executionCommands = createStudioExecutionCommandHandlers({
    requireProject,
    getEvidence: () => session.executionEvidence,
    setEvidence: (evidence) => {
      session.executionEvidence = evidence;
    },
    getFrameIndex: () => session.executionFrameIndex,
    setFrameIndex: (frameIndex) => {
      session.executionFrameIndex = frameIndex;
    },
    getStatus: () => session.executionStatus,
    setStatus: (status) => {
      session.executionStatus = status;
    },
    refreshExecutionViews: () => refreshExecutionViews(),
    revealCanonicalNode: (nodeId) => projectionCommands.revealCanonicalNode(nodeId),
  });
  const proposalCommands = createStudioProposalCommandHandlers({
    requireProject,
    getCurrentProject: () => session.current,
    setCurrentProject: (project) => {
      session.current = project;
    },
    getCurrentProjectionId: () => session.currentProjectionId,
    getActiveProposal: () => session.activeProposal,
    setActiveProposal: (proposal) => {
      session.activeProposal = proposal;
    },
    undoStack: () => session.undoStack,
    redoStack: () => session.redoStack,
    refreshCompanionViews: () => refreshCompanionViews(),
    afterCanonicalProgramChange,
    openProjection: projectionCommands.openProjection,
    revealCanonicalNode: (nodeId) => projectionCommands.revealCanonicalNode(nodeId),
  });
  const companionCommands = createStudioCompanionCommandHandlers({
    requireProject,
    currentExecutionView: executionCommands.currentExecutionView,
    getExecutionEvidence: () => session.executionEvidence,
    companionTurns: () => session.companionTurns,
    refreshCompanionViews: () => refreshCompanionViews(),
    revealCanonicalNode: (nodeId) => projectionCommands.revealCanonicalNode(nodeId),
    reviewProposalSession: proposalCommands.reviewProposalSession,
  });
  const surfaceCommands = createStudioSurfaceCommandHandlers({
    context,
    requireProject,
    currentExecutionView: executionCommands.currentExecutionView,
    resetExecution: executionCommands.resetExecution,
    getProgram: () => session.current?.project.stored.program,
    commitProgram: proposalCommands.commitProgram,
    getActiveProposal: () => session.activeProposal,
    reviewProposalSession: proposalCommands.reviewProposalSession,
    revealCanonicalNode: (nodeId) => projectionCommands.revealCanonicalNode(nodeId),
  });
  const projectCommands = createStudioProjectCommandHandlers({
    getCurrentProjectionId: () => session.currentProjectionId,
    setCurrentProject: (project) => {
      session.current = project;
    },
    resetProjectSessionState,
    refreshStudioViews: () => refreshStudioViews(),
    refreshExecutionViews: () => refreshExecutionViews(),
    refreshCompanionViews: () => refreshCompanionViews(),
    updateStudioContext,
    requireProject,
    openProjection: projectionCommands.openProjection,
  });
  const developerCommands = createStudioDeveloperCommandHandlers({ requireProject });
  const accountCommands = createStudioAccountCommandHandlers({
    context,
    agentStatusItem,
    requireProject,
    getCurrentProject: () => session.current,
    setCurrentProject: (project) => {
      session.current = project;
    },
    currentProjectionId: () => session.currentProjectionId,
    resetProjectSessionState,
    refreshStudioViews: () => refreshStudioViews(),
    refreshExecutionViews: () => refreshExecutionViews(),
    refreshCompanionViews: () => refreshCompanionViews(),
    updateStudioContext,
    openProjection: projectionCommands.openProjection,
    exportAgorixProject: projectCommands.exportAgorixProject,
  });
  const registeredViews = registerStudioViews({
    context,
    getProjectionProject: () => requireProject()?.project,
    getCurrentProject: () => session.current?.project,
    getCurrentProjectionId: () => session.currentProjectionId,
    projectionUri: projectionCommands.projectionUri,
    projectionIdFromUri: projectionCommands.projectionIdFromUri,
    currentExecutionView: executionCommands.currentExecutionView,
    companionTurns: () => session.companionTurns,
  });
  refreshStudioViews = registeredViews.refreshStudioViews;
  refreshExecutionViews = registeredViews.refreshExecutionViews;
  refreshCompanionViews = registeredViews.refreshCompanionViews;
  try {
    context.subscriptions.push(
      ...registeredViews.disposables,
      ...registerStudioCommands(output, {
        createProject: projectCommands.createProject,
        openProject: projectCommands.openProject,
        exportAgorixProject: projectCommands.exportAgorixProject,
        checkAgentHealth: accountCommands.checkAgentHealth,
        setAgentCredential: accountCommands.setAgentCredential,
        clearAgentCredential: accountCommands.clearAgentCredential,
        signIn: accountCommands.signIn,
        signOut: accountCommands.signOut,
        listRemoteProjects: accountCommands.listRemoteProjects,
        openRemoteProject: accountCommands.openRemoteProject,
        saveRemoteProject: accountCommands.saveRemoteProject,
        openProjection: projectionCommands.openProjection,
        switchProjection: projectionCommands.switchProjection,
        revealCanonicalNode: projectionCommands.revealCanonicalNode,
        openWorldPreview: surfaceCommands.openWorldPreview,
        runExecution: executionCommands.runExecution,
        stepExecution: executionCommands.stepExecution,
        resetExecution: executionCommands.resetExecution,
        stopExecution: executionCommands.stopExecution,
        selectExecutionStep: executionCommands.selectExecutionStep,
        companionExplain: () => companionCommands.companionCommand("explain"),
        companionChallenge: () => companionCommands.companionCommand("challenge"),
        companionDebug: () => companionCommands.companionCommand("debug"),
        companionReflect: () => companionCommands.companionCommand("reflect"),
        companionBuild: () => companionCommands.companionCommand("build"),
        suggestFirstStep: proposalCommands.suggestFirstStepCommand,
        applyProposal: proposalCommands.applyActiveProposal,
        rejectProposal: proposalCommands.rejectActiveProposal,
        revealProposalAffectedNode: proposalCommands.revealProposalAffectedNode,
        undoProposal: proposalCommands.undoProposal,
        redoProposal: proposalCommands.redoProposal,
        showEvidence: () => executionCommands.showEvidence(output),
        validateProject: () => developerCommands.validateProjectCommand(output),
        runChecks: developerCommands.runChecksCommand,
        openWorkbench: surfaceCommands.openWorkbench,
        showDeveloperContext: () => developerCommands.showDeveloperContext(output),
        openScm: developerCommands.openScm,
        suggestRepeat: proposalCommands.suggestRepeatCommand,
      }),
    );
    updateStudioContext();
    // Fire and forget: a slow or failing provider must never delay activation or editing.
    void refreshAgentStatus(context, agentStatusItem);
  } catch (error) {
    reportFailure(output, "activation failed", error);
    output.show(true);
    throw error;
  }
}

export function deactivate(): void {
  disposeWorkbench();
  disposeWorldPreview();
  clearStudioSession(session);
}
