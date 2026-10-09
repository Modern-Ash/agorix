import * as vscode from "vscode";
import {
  createStudioAccountCommandHandlers,
  refreshAgentStatus,
  createAgentClient,
} from "./commands/accounts.js";
import { createStudioCompanionCommandHandlers } from "./commands/companion.js";
import { createStudioDeveloperCommandHandlers } from "./commands/developer.js";
import { createStudioEvidenceExportCommandHandlers } from "./commands/evidence.js";
import { createStudioExecutionCommandHandlers } from "./commands/execution.js";
import { createStudioProjectionCommandHandlers } from "./commands/projections.js";
import { createStudioProjectCommandHandlers } from "./commands/projects.js";
import { createStudioProposalCommandHandlers } from "./commands/proposals.js";
import { createStudioSurfaceCommandHandlers } from "./commands/surfaces.js";
import { reportFailure } from "./commands/guarded.js";
import { registerStudioCommands } from "./commands/register.js";
import { clearStudioSession, createStudioSessionState, REMOTE_SCHEME } from "./store/session.js";
import {
  afterCanonicalProgramChange as applyCanonicalProgramChange,
  requireProject as requireProjectFromState,
  resetProjectSessionState as resetSessionProjectState,
  updateStudioContext as updateContextFromState,
} from "./store/lifecycle.js";
import {
  clearWorkbenchAmbientHint,
  disposeWorkbench,
  publishWorkbenchAmbientHint,
  refreshWorkbench,
} from "./host/workbenchPanel.js";
import { disposeWorldPreview, refreshWorldPreviewSync } from "./host/worldPreviewPanel.js";
import { createSyncHub } from "./sync/syncHub.js";
import { canDoCompanionAction, offerActionAllowed } from "./assistance.js";
import { createProviderWiring } from "./providerWiring.js";
import { registerCodeSync } from "./sync/codeSync.js";
import { programToWorkspace } from "@agorix/block-editor";
import type { ProjectMetadata } from "@agorix/persistence";
import { createAgentPort } from "./host/agentPort.js";
import { registerStudioViews } from "./views/register.js";
import { AmbientController } from "./ambient/ambientController.js";
import { registerAmbientLenses } from "./ambient/lenses.js";
import { createHttpLayaTransport } from "./ambient/layaTransport.js";
import { StudioSignalAdapter } from "./studioSignals.js";
import {
  createStoredProjectWithMetadata,
  countProgramStatements,
  nodeIdsForProjectionLines,
  openProjectionDocument,
  parseProjectFile,
  semanticHash,
  serializeProjectFile,
  serializeStoredProject,
  suggestRepeat,
  type StudioCompanionAction,
} from "./studioCore.js";
import { canOffer } from "@agorix/agent-workflow";

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
  const hub = createSyncHub();
  // Assigned once AI settings and the LAYA transport exist; used lazily by the hooks below.
  const providerWiring: { current?: ReturnType<typeof createProviderWiring> } = {};
  const selectNode = (nodeId: string): Promise<void> => {
    hub.select(nodeId, "runtime");
    return Promise.resolve();
  };
  let refreshStudioViews: () => void = () => undefined;
  let refreshExecutionViews: () => void = () => undefined;
  let refreshCompanionViews: () => void = () => undefined;
  const signalAdapterRef: { current?: StudioSignalAdapter } = {};
  const afterCanonicalProgramChange = (): void => {
    applyCanonicalProgramChange(session, {
      refreshStudioViews,
      refreshExecutionViews,
      refreshCompanionViews,
    });
    try {
      const program = session.current?.project.stored.program;
      if (program !== undefined) {
        hub.reconcile(programToWorkspace(program).mapping.map((entry) => entry.nodeId));
      }
    } catch {
      hub.reconcile([]);
    }
    const current = session.current?.project;
    if (current !== undefined) {
      signalAdapterRef.current?.programShape({
        statementCount: countProgramStatements(current.stored.program),
        repeatOccurrences: suggestRepeat(current) === undefined ? 0 : 3,
      });
    }
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
    revealCanonicalNode: (nodeId) => {
      hub.select(nodeId, "inspector");
      return Promise.resolve();
    },
    didRunExecution: (view) => {
      const failedNode =
        view.currentFrame?.highlightedNodeId ??
        [...view.inspectorSteps].reverse().find((step) => step.nodeId !== undefined)?.nodeId;
      const failure = view.outcome === "budget-exceeded" ? failedNode : undefined;
      if (view.status === "idle") {
        hub.executionReset();
      } else if (failure !== undefined) {
        hub.executionFailed(failure);
      } else if (view.currentFrame?.highlightedNodeId !== undefined) {
        hub.executionStep(view.currentFrame.highlightedNodeId);
      }
      signalAdapterRef.current?.runResult({
        ok: view.outcome !== "budget-exceeded",
        code: view.outcome,
        ...(view.outcome === "budget-exceeded" && failedNode !== undefined
          ? { nodeId: failedNode }
          : {}),
      });
      refreshWorkbench();
    },
  });
  const proposalCommands = createStudioProposalCommandHandlers({
    requireProject,
    agentAgreements: () => session.agentAgreements,
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
    revealCanonicalNode: selectNode,
  });
  const companionCommands = createStudioCompanionCommandHandlers({
    requireProject,
    agentAgreements: () => session.agentAgreements,
    currentExecutionView: executionCommands.currentExecutionView,
    getExecutionEvidence: () => session.executionEvidence,
    companionTurns: () => session.companionTurns,
    refreshCompanionViews: () => refreshCompanionViews(),
    revealCanonicalNode: selectNode,
    reviewProposalSession: proposalCommands.reviewProposalSession,
    providerBuild: async (project) =>
      providerWiring.current === undefined
        ? { origin: "built-in", reason: "no-provider" }
        : providerWiring.current.source().request(project, "build"),
  });
  const ambientStatusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, -1);
  const aiEnabled = (): boolean =>
    vscode.workspace.getConfiguration("agorixStudio.agent").get("enabled", true) &&
    session.agentAgreements.aiEnabled;
  const agentConfig = () => vscode.workspace.getConfiguration("agorixStudio.agent");
  const ambientBudgetLimit = (): number | undefined => {
    const value = agentConfig().get("ambientBudgetRequests", 20);
    return typeof value === "number" && Number.isInteger(value) ? Math.max(0, value) : 20;
  };
  const budgetRemaining = (): number | undefined => {
    const limit = ambientBudgetLimit();
    return limit === undefined ? undefined : Math.max(0, limit - session.ambientOffersUsed);
  };
  const layaTransport = createHttpLayaTransport({
    endpoint: agentConfig().get("layaEndpoint", ""),
    allowRemote: agentConfig().get("allowRemote", false),
    timeoutMs: agentConfig().get("healthTimeoutMs", 1500),
    fetch: (input, init) => fetch(input, init),
  });
  providerWiring.current = createProviderWiring({
    context,
    aiEnabled,
    layaTransport,
  });
  const ambientController = new AmbientController({
    statusBarItem: ambientStatusItem,
    allowAction: (action) => offerActionAllowed(session.agentAgreements, action),
    programId: () =>
      session.current === undefined
        ? undefined
        : semanticHash(session.current.project.stored.program),
    executionStatus: () => session.executionStatus,
    aiEnabled,
    canOfferSignal: (kind) =>
      kind === "runtime-error" ||
      kind === "stalled" ||
      kind === "repeated-error" ||
      kind === "repeat-pattern" ||
      kind === "first-step"
        ? canOffer(session.agentAgreements, kind)
        : true,
    budgetRemaining,
    recordOffer: (outcome) => {
      if (outcome === "shown") {
        session.ambientOffersUsed += 1;
      }
      session.ambientOfferStats[outcome] += 1;
      const remaining = budgetRemaining();
      session.ambientBudgetCapped = remaining !== undefined && remaining <= 0;
    },
    runCompanionAction: async (action) => {
      const companionAction: StudioCompanionAction = action === "propose" ? "build" : action;
      await companionCommands.companionCommand(companionAction);
    },
    proactivePipeline: () => providerWiring.current?.ambientPipeline(),
    showCanvasHint: publishWorkbenchAmbientHint,
    clearCanvasHint: clearWorkbenchAmbientHint,
  });
  const signalAdapter = new StudioSignalAdapter({
    onSignal: (signal) => void ambientController.handleSignal(signal),
    isStudioDocument: (document) => document.uri.scheme === "agorix-studio",
    nodeIdsForLines: (startLine, endLine) => {
      const current = session.current?.project;
      if (current === undefined) return [];
      const projection = openProjectionDocument(current, session.currentProjectionId);
      return nodeIdsForProjectionLines(projection, startLine, endLine);
    },
  });
  signalAdapterRef.current = signalAdapter;
  context.subscriptions.push(ambientController, signalAdapter);
  const commitMetadata = async (metadata: ProjectMetadata): Promise<void> => {
    const open = requireProject();
    if (open === undefined) {
      return;
    }
    const previousRaw = serializeStoredProject(open.project.stored);
    const stored = createStoredProjectWithMetadata(open.project.stored, metadata);
    const raw = serializeProjectFile(stored, open.uri.fsPath);
    if (open.uri.scheme !== REMOTE_SCHEME) {
      await vscode.workspace.fs.writeFile(open.uri, new TextEncoder().encode(raw));
    }
    session.current = {
      uri: open.uri,
      project: parseProjectFile(raw, open.uri.fsPath),
      ...(open.remote === undefined ? {} : { remote: open.remote }),
    };
    session.undoStack.push({ uri: open.uri, raw: previousRaw });
    session.redoStack.length = 0;
    afterCanonicalProgramChange();
    await projectionCommands.openProjection(session.currentProjectionId);
  };
  const surfaceCommands = createStudioSurfaceCommandHandlers({
    context,
    hub,
    requireProject,
    currentExecutionView: executionCommands.currentExecutionView,
    resetExecution: executionCommands.resetExecution,
    getProgram: () => session.current?.project.stored.program,
    getProject: () => session.current?.project,
    commitProgram: proposalCommands.commitProgram,
    getMetadata: () => session.current?.project.stored.metadata,
    commitMetadata,
    getActiveProposal: () => session.activeProposal,
    reviewProposalSession: proposalCommands.reviewProposalSession,
    revealCanonicalNode: selectNode,
    askCompanion: async (action, nodeId) => {
      await companionCommands.companionCommand(action, nodeId);
    },
    updateAgentAgreements: (agreements) => {
      session.agentAgreements = agreements;
      if (!aiEnabled()) {
        ambientController.clear();
      }
    },
    agentPort: () =>
      createAgentPort({
        getProject: () => session.current?.project,
        getActiveProposal: () => session.activeProposal,
        setActiveProposal: (proposal) => {
          session.activeProposal = proposal;
          refreshCompanionViews();
        },
        applyActiveProposal: proposalCommands.applyActiveProposal,
        commitProgram: proposalCommands.commitProgram,
        providerProposal: async (project, task) =>
          providerWiring.current === undefined
            ? { origin: "built-in", reason: "no-provider" }
            : providerWiring.current.source().request(project, task),
        providerIntentPlan: (request) => {
          const client = providerWiring.current?.client();
          if (client === undefined) return undefined;
          return client
            .planIntent(request)
            .then((outcome) => (outcome.status === "response" ? outcome.response : undefined));
        },
        rejectActiveProposal: proposalCommands.rejectActiveProposal,
        runAndGetResult: () => {
          const view = executionCommands.runExecution();
          return view === undefined
            ? undefined
            : { world: view.finalWorld, stepsUsed: view.stepsUsed };
        },
        events: session.agentEvents,
      }),
  });
  const revealProjectSurfaces = (): void => {
    surfaceCommands.openWorldPreview();
    void vscode.commands.executeCommand("agorixStudio.companion.focus");
  };
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
    afterProjectOpened: revealProjectSurfaces,
    requireProject,
    openProjection: projectionCommands.openProjection,
  });
  const developerCommands = createStudioDeveloperCommandHandlers({
    requireProject,
    agentEventCount: () => session.agentEvents.length,
    ambientOfferStats: () => ({ ...session.ambientOfferStats }),
  });
  const evidenceExportCommands = createStudioEvidenceExportCommandHandlers({
    requireProject,
    agentEvents: () => session.agentEvents,
    agentAgreements: () => session.agentAgreements,
    ambientOfferStats: () => ({ ...session.ambientOfferStats }),
    getExecutionEvidence: () => session.executionEvidence,
  });
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
  const unsubscribeViewSync = hub.subscribe((state, source) => {
    refreshWorldPreviewSync(state);
    if (source !== "inspector" && state.selectedNodeId !== undefined) {
      registeredViews.revealInspectorNode(state.selectedNodeId);
    }
  });
  context.subscriptions.push(
    { dispose: unsubscribeViewSync },
    registerCodeSync({
      hub,
      currentProjection: () => {
        const project = session.current?.project;
        return project === undefined
          ? undefined
          : openProjectionDocument(project, session.currentProjectionId);
      },
      revealCanonicalNode: (nodeId) => projectionCommands.revealCanonicalNode(nodeId),
    }),
  );
  try {
    context.subscriptions.push(
      ...registeredViews.disposables,
      ...registerStudioCommands(output, {
        createProject: projectCommands.createProject,
        openProject: projectCommands.openProject,
        exportAgorixProject: projectCommands.exportAgorixProject,
        exportEducatorEvidence: evidenceExportCommands.exportEducatorEvidence,
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
        companionExplain: (nodeId) => companionCommands.companionCommand("explain", nodeId),
        companionChallenge: (nodeId) => companionCommands.companionCommand("challenge", nodeId),
        companionDebug: (nodeId) => companionCommands.companionCommand("debug", nodeId),
        companionReflect: (nodeId) => companionCommands.companionCommand("reflect", nodeId),
        companionBuild: (nodeId) => companionCommands.companionCommand("build", nodeId),
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
      vscode.commands.registerCommand("agorixStudio.ambientOffer", () =>
        ambientController.showOffer(),
      ),
      ...registerAmbientLenses({
        allowAction: (action) => canDoCompanionAction(session.agentAgreements, action),
        getProjection: (document) => {
          const current = session.current?.project;
          if (current === undefined || document.uri.scheme !== "agorix-studio") return undefined;
          return openProjectionDocument(
            current,
            projectionCommands.projectionIdFromUri(document.uri),
          );
        },
        getExecutionView: () => executionCommands.currentExecutionView(),
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
