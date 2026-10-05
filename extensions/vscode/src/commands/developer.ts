import * as vscode from "vscode";
import { t } from "../l10n.js";
import { createDeveloperContext, createValidationReport } from "../studioCore.js";
import type { OpenProject } from "../store/session.js";

export interface StudioDeveloperCommandPort {
  requireProject(): OpenProject | undefined;
  agentEventCount(): number;
  ambientOfferStats(): {
    readonly shown: number;
    readonly accepted: number;
    readonly dismissed: number;
    readonly ignored: number;
  };
}

export interface StudioDeveloperCommandHandlers {
  validateProjectCommand(output: vscode.OutputChannel): string | undefined;
  runChecksCommand(): Promise<vscode.Task | undefined>;
  showDeveloperContext(output: vscode.OutputChannel): Promise<string | undefined>;
  openScm(): Promise<void>;
}

export function createStudioDeveloperCommandHandlers(
  port: StudioDeveloperCommandPort,
): StudioDeveloperCommandHandlers {
  const validateProjectCommand = (output: vscode.OutputChannel): string | undefined => {
    const open = port.requireProject();
    if (open === undefined) {
      return undefined;
    }
    const report = createValidationReport(open.project.stored);
    const text = JSON.stringify(report, null, 2);
    output.clear();
    output.appendLine(text);
    output.show(true);
    void vscode.window.showInformationMessage(
      t(
        "Agorix validation {0}; {1} projection diagnostics.",
        report.outcome,
        report.diagnostics.length,
      ),
    );
    return text;
  };

  const runChecksCommand = async (): Promise<vscode.Task | undefined> => {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (folder === undefined) {
      await vscode.commands.executeCommand("workbench.action.tasks.runTask");
      return undefined;
    }
    const task = new vscode.Task(
      { type: "shell", task: "agorix-verify" },
      folder,
      "agorix: verify",
      "agorix",
      new vscode.ShellExecution("pnpm verify"),
      [],
    );
    task.problemMatchers = [];
    await vscode.tasks.executeTask(task);
    return task;
  };

  const showDeveloperContext = async (
    output: vscode.OutputChannel,
  ): Promise<string | undefined> => {
    const open = port.requireProject();
    if (open === undefined) {
      return undefined;
    }
    const context = {
      ...createDeveloperContext(open.project.stored, {
        ...(open.remote === undefined ? {} : { revision: open.remote.revision }),
      }),
      agentEvidence: {
        agentEventCount: port.agentEventCount(),
        ambientOffers: port.ambientOfferStats(),
      },
    };
    const text = JSON.stringify(context, null, 2);
    output.clear();
    output.appendLine(text);
    output.show(true);
    return text;
  };

  const openScm = async (): Promise<void> => {
    await vscode.commands.executeCommand("workbench.view.scm");
  };

  return { validateProjectCommand, runChecksCommand, showDeveloperContext, openScm };
}
