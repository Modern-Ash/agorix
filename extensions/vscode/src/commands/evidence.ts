import * as vscode from "vscode";
import { t } from "../l10n.js";
import { MAX_AGENT_EVENTS, type AgentAgreements, type AgentEvent } from "@agorix/agent-workflow";
import { getLocalizedFirstMission } from "@agorix/curriculum";
import { createEducatorEvidenceExport, formatEducatorSummary } from "@agorix/learning-evidence";
import { touchingGoal } from "@agorix/runtime";
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

    const exportLabel = t("Export");
    const confirmed = await vscode.window.showWarningMessage(
      t(
        "Export one local session of educator evidence? This writes counts only: no names, emails, file paths, learner text or raw AI output.",
      ),
      { modal: true },
      exportLabel,
    );
    if (confirmed !== exportLabel) return undefined;

    const uri = await vscode.window.showSaveDialog({
      filters: { [t("Agorix educator evidence")]: ["json"] },
      saveLabel: t("Export educator evidence"),
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
      // A run that merely finishes ("completed") is not the goal; the runtime world is the fact.
      completedByRuntime: touchingGoal(runtimeEvidence.result.world),
    });
    const json = `${JSON.stringify(data, null, 2)}\n`;
    const summary = formatEducatorSummary(data);
    await vscode.workspace.fs.writeFile(uri, new TextEncoder().encode(json));
    const summaryUri =
      uri.scheme === undefined || uri.scheme === "file"
        ? vscode.Uri.file(summaryPath(uri.fsPath))
        : undefined;
    if (summaryUri !== undefined && !(await exists(summaryUri))) {
      await vscode.workspace.fs.writeFile(summaryUri, new TextEncoder().encode(summary));
      void vscode.window.showInformationMessage(t("Exported educator evidence JSON and summary."));
    } else {
      void vscode.window.showInformationMessage(t("Exported educator evidence JSON."));
    }
    return uri;
  };

  return { exportEducatorEvidence };
}

function summaryPath(jsonPath: string): string {
  return jsonPath.toLowerCase().endsWith(".json")
    ? `${jsonPath.slice(0, -5)}.md`
    : `${jsonPath}.md`;
}

async function exists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}
