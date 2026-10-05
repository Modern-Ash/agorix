import * as vscode from "vscode";
import type { AgentAgreements } from "@agorix/agent-workflow";
import type { AgentVerb } from "@agorix/interaction-core";
import type { ProjectProgram } from "@agorix/program-model";
import {
  evidenceForProgram,
  type StudioExecutionViewState,
  type StudioProject,
  type StudioProposalSession,
} from "../studioCore.js";
import { openWorkbenchPanel, refreshWorkbench } from "../host/workbenchPanel.js";
import { openWorldPreviewPanel } from "../host/worldPreviewPanel.js";
import type { AgentPort } from "../host/agentHost.js";
import type { WorkbenchLocale } from "../host/workbenchHtml.js";
import type { OpenProject } from "../store/session.js";
import type { SyncHub } from "../sync/syncHub.js";

export interface StudioSurfaceCommandPort {
  readonly context: vscode.ExtensionContext;
  readonly hub: SyncHub;
  requireProject(): OpenProject | undefined;
  currentExecutionView(): StudioExecutionViewState | undefined;
  resetExecution(): StudioExecutionViewState | undefined;
  getProgram(): ProjectProgram | undefined;
  /** The open project without any prompt; undefined when none is open. */
  getProject(): StudioProject | undefined;
  commitProgram(program: ProjectProgram): Promise<void>;
  getActiveProposal(): StudioProposalSession | undefined;
  reviewProposalSession(proposal: StudioProposalSession): Promise<void>;
  revealCanonicalNode(nodeId: string): Promise<void>;
  askCompanion(action: AgentVerb, nodeId: string | undefined): Promise<void>;
  updateAgentAgreements(agreements: AgentAgreements): void;
  agentPort(): AgentPort;
}

export interface StudioSurfaceCommandHandlers {
  openWorldPreview(): StudioExecutionViewState | undefined;
  openWorkbench(): Promise<void>;
}

export function createStudioSurfaceCommandHandlers(
  port: StudioSurfaceCommandPort,
): StudioSurfaceCommandHandlers {
  const workbenchLocale = (open: OpenProject): WorkbenchLocale =>
    open.project.stored.metadata.locale?.toLowerCase().startsWith("es") ? "es" : "en";

  const openWorldPreview = (): StudioExecutionViewState | undefined => {
    const view = port.currentExecutionView() ?? port.resetExecution();
    if (view === undefined) {
      return undefined;
    }
    openWorldPreviewPanel(view, (nodeId) => {
      port.hub.select(nodeId, "preview");
    });
    return view;
  };

  const openWorkbench = async (): Promise<void> => {
    const open = port.requireProject();
    if (open === undefined) {
      return;
    }
    openWorkbenchPanel(
      port.context,
      {
        getProgram: port.getProgram,
        reachedGoal: () => {
          const project = port.getProject();
          if (project === undefined) return false;
          try {
            return evidenceForProgram(project, project.stored.program).reachedGoal;
          } catch {
            return false;
          }
        },
        commit: async (program) => {
          if (port.requireProject() === undefined) {
            return;
          }
          await port.commitProgram(program);
        },
        openProposalReview: async () => {
          const proposal = port.getActiveProposal();
          if (proposal !== undefined) {
            await port.reviewProposalSession(proposal);
          }
        },
        reveal: (nodeId) => {
          port.hub.select(nodeId, "canvas");
          return Promise.resolve();
        },
        askAgent: (verb, nodeId) => port.askCompanion(verb, nodeId),
        updateAgreements: port.updateAgentAgreements,
      },
      port.agentPort(),
      port.hub,
      workbenchLocale(open),
    );
    refreshWorkbench();
  };

  return { openWorldPreview, openWorkbench };
}
