import * as vscode from "vscode";
import type { AgentAgreements } from "@agorix/agent-workflow";
import { programSemanticHash } from "@agorix/proposals";
import type { LearningCompanionResponse } from "@agorix/tutor-contract";
import { canDoCompanionAction, ceilingMessage } from "../assistance.js";
import {
  createCompanionTurn,
  type StudioCompanionAction,
  type StudioCompanionTurn,
  type StudioExecutionEvidence,
  type StudioExecutionViewState,
  type StudioProposalSession,
} from "../studioCore.js";
import type { OpenProject } from "../store/session.js";
import type { ProviderProposalResult } from "../studioProposalSource.js";

export interface StudioCompanionCommandPort {
  requireProject(): OpenProject | undefined;
  currentExecutionView(): StudioExecutionViewState | undefined;
  getExecutionEvidence(): StudioExecutionEvidence | undefined;
  companionTurns(): StudioCompanionTurn[];
  refreshCompanionViews(): void;
  agentAgreements(): AgentAgreements;
  revealCanonicalNode(nodeId: string): Promise<void>;
  reviewProposalSession(proposal: StudioProposalSession): Promise<void>;
  /** Asks for a provider-backed build proposal; absent means built-in only. */
  providerBuild?(project: OpenProject["project"]): Promise<ProviderProposalResult>;
  providerHelp?(
    project: OpenProject["project"],
    action: Exclude<StudioCompanionAction, "build">,
    selectedNodeIds: readonly string[],
    evidence: StudioExecutionEvidence | undefined,
  ): Promise<LearningCompanionResponse | undefined>;
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
    if (!canDoCompanionAction(port.agentAgreements(), action)) {
      void vscode.window.showInformationMessage(ceilingMessage(port.agentAgreements()));
      return undefined;
    }
    const selected =
      typeof nodeId === "string"
        ? nodeId
        : port.currentExecutionView()?.currentFrame?.highlightedNodeId;
    const evidence = port.getExecutionEvidence();
    const asked =
      action === "build" && port.providerBuild !== undefined
        ? await port.providerBuild(open.project)
        : undefined;
    const help =
      action !== "build" && port.providerHelp !== undefined
        ? await port.providerHelp(
            open.project,
            action,
            selected === undefined ? [] : [selected],
            evidence,
          )
        : undefined;
    const current = port.requireProject();
    if (
      current === undefined ||
      current.uri.toString() !== open.uri.toString() ||
      programSemanticHash(current.project.stored.program) !==
        programSemanticHash(open.project.stored.program)
    )
      return undefined;
    const turn = createCompanionTurn(open.project, action, {
      ...(selected === undefined ? {} : { selectedNodeIds: [selected] }),
      ...(evidence === undefined ? {} : { evidence }),
      ...(asked?.origin === "provider"
        ? { providerResponse: asked.response }
        : help === undefined
          ? {}
          : { providerResponse: help }),
    });
    if (asked?.origin === "built-in" && asked.notice !== undefined) {
      void vscode.window.showInformationMessage(asked.notice);
    }
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
