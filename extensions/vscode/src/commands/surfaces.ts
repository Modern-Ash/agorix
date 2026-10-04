import * as vscode from "vscode";
import type { AgentAgreements } from "@agorix/agent-workflow";
import type { ProjectProgram } from "@agorix/program-model";
import type { StudioExecutionViewState, StudioProposalSession } from "../studioCore.js";
import { openWorkbenchPanel, refreshWorkbench } from "../host/workbenchPanel.js";
import { openWorldPreviewPanel } from "../host/worldPreviewPanel.js";
import type { AgentPort } from "../host/agentHost.js";
import type { OpenProject } from "../store/session.js";

export interface StudioSurfaceCommandPort {
  readonly context: vscode.ExtensionContext;
  requireProject(): OpenProject | undefined;
  currentExecutionView(): StudioExecutionViewState | undefined;
  resetExecution(): StudioExecutionViewState | undefined;
  getProgram(): ProjectProgram | undefined;
  commitProgram(program: ProjectProgram): Promise<void>;
  getActiveProposal(): StudioProposalSession | undefined;
  reviewProposalSession(proposal: StudioProposalSession): Promise<void>;
  revealCanonicalNode(nodeId: string): Promise<void>;
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
  const openWorldPreview = (): StudioExecutionViewState | undefined => {
    const view = port.currentExecutionView() ?? port.resetExecution();
    if (view === undefined) {
      return undefined;
    }
    openWorldPreviewPanel(view, port.revealCanonicalNode);
    return view;
  };

  const openWorkbench = async (): Promise<void> => {
    if (port.requireProject() === undefined) {
      return;
    }
    openWorkbenchPanel(
      port.context,
      {
        getProgram: port.getProgram,
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
        reveal: (nodeId) => port.revealCanonicalNode(nodeId),
        updateAgreements: port.updateAgentAgreements,
      },
      port.agentPort(),
    );
    refreshWorkbench();
  };

  return { openWorldPreview, openWorkbench };
}
