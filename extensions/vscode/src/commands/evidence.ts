import * as vscode from "vscode";
import { MAX_AGENT_EVENTS, type AgentAgreements, type AgentEvent } from "@agorix/agent-workflow";
import { getLocalizedFirstMission } from "@agorix/curriculum";
import { createEducatorEvidenceExport, formatEducatorSummary } from "@agorix/learning-evidence";
import {
  createExecutionEvidence,
  currentProgramHash,
  type StudioExecutionEvidence,
} from "../studioCore.js";
import type { OpenProject } from "../store/session.js";

export interface StudioEvidenceExportCommandPort {
  requireProject(): OpenProject | undefined;
  agentEvents(): readonly AgentEvent[];
  agentAgreements(): AgentAgreements;
  ambientOfferStats(): {
    readonly shown: number;
    readonly accepted: number;
    readonly dismissed: number;
    readonly ignored: number;
  };
  getExecutionEvidence(): StudioExecutionEvidence | undefined;
}

export interface StudioEvidenceExportCommandHandlers {
  exportEducatorEvidence(): Promise<vscode.Uri | undefined>;
}

export function createStudioEvidenceExportCommandHandlers(
  port: StudioEvidenceExportCommandPort,
): StudioEvidenceExportCommandHandlers {
  const exportEducatorEvidence = async (): Promise<vscode.Uri | undefined> => {
    const open = port.requireProject();
    if (open === undefined) return undefined;

    const confirmed = await vscode.window.showWarningMessage(
      "Export one local session of educator evidence? This writes counts only: no names, emails, file paths, learner text or raw AI output.",
      { modal: true },
      "Export",
    );
    if (confirmed !== "Export") return undefined;

    const uri = await vscode.window.showSaveDialog({
      filters: { "Agorix educator evidence": ["json"] },
      saveLabel: "Export educator evidence",
      defaultUri: vscode.Uri.file("agorix-educator-evidence.json"),
    });
    if (uri === undefined) return undefined;

    const runtimeEvidence =
      port.getExecutionEvidence() ?? createExecutionEvidence(open.project.stored);
    const mission = getLocalizedFirstMission(open.project.stored.metadata.locale);
    const agreements = port.agentAgreements();
    const data = createEducatorEvidenceExport({
      missionId: mission.id,
      programHash: currentProgramHash(open.project.stored.program),
      events: port.agentEvents(),
      truncated: port.agentEvents().length >= MAX_AGENT_EVENTS,
      agreements: {
        aiEnabled: agreements.aiEnabled,
        mode: agreements.mode,
        assistanceCeiling: agreements.assistanceCeiling,
        requirePredictionBeforeAccept: agreements.requirePredictionBeforeAccept,
      },
      ambientOffers: port.ambientOfferStats(),
      completedByRuntime: runtimeEvidence.result.outcome === "completed",
    });
    const json = `${JSON.stringify(data, null, 2)}\n`;
    const summary = formatEducatorSummary(data);
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(json));
    const summaryUri = vscode.Uri.file(summaryPath(uri.fsPath));
    await vscode.workspace.fs.writeFile(summaryUri, new TextEncoder().encode(summary));
    void vscode.window.showInformationMessage("Exported educator evidence JSON and summary.");
    return uri;
  };

  return { exportEducatorEvidence };
}

function summaryPath(jsonPath: string): string {
  return jsonPath.toLowerCase().endsWith(".json")
    ? `${jsonPath.slice(0, -5)}.md`
    : `${jsonPath}.md`;
}
