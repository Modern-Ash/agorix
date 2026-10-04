import * as vscode from "vscode";
import {
  createCompanionTurn,
  type StudioCompanionAction,
  type StudioCompanionTurn,
  type StudioExecutionEvidence,
  type StudioExecutionViewState,
  type StudioProposalSession,
} from "../studioCore.js";
import type { OpenProject } from "../store/session.js";

export interface StudioCompanionCommandPort {
  requireProject(): OpenProject | undefined;
  currentExecutionView(): StudioExecutionViewState | undefined;
  getExecutionEvidence(): StudioExecutionEvidence | undefined;
  companionTurns(): StudioCompanionTurn[];
  refreshCompanionViews(): void;
  revealCanonicalNode(nodeId: string): Promise<void>;
  reviewProposalSession(proposal: StudioProposalSession): Promise<void>;
}

export interface StudioCompanionCommandHandlers {
  companionCommand(
    action: StudioCompanionAction,
    nodeId?: unknown,
  ): Promise<StudioCompanionTurn | undefined>;
}

export function createStudioCompanionCommandHandlers(
  port: StudioCompanionCommandPort,
): StudioCompanionCommandHandlers {
  const companionCommand = async (
    action: StudioCompanionAction,
    nodeId?: unknown,
  ): Promise<StudioCompanionTurn | undefined> => {
    const open = port.requireProject();
    if (open === undefined) {
      return undefined;
    }
    const selected =
      typeof nodeId === "string"
        ? nodeId
        : port.currentExecutionView()?.currentFrame?.highlightedNodeId;
    const evidence = port.getExecutionEvidence();
    const turn = createCompanionTurn(open.project, action, {
      ...(selected === undefined ? {} : { selectedNodeIds: [selected] }),
      ...(evidence === undefined ? {} : { evidence }),
    });
    port.companionTurns().unshift(turn);
    port.refreshCompanionViews();
    if (turn.selectedNodeIds[0] !== undefined) {
      await port.revealCanonicalNode(turn.selectedNodeIds[0]);
    }
    if (turn.proposal !== undefined) {
      await port.reviewProposalSession(turn.proposal);
    } else {
      void vscode.window.showInformationMessage(turn.message);
    }
    return turn;
  };

  return { companionCommand };
}
