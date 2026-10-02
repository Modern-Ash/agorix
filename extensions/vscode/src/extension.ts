import * as vscode from "vscode";
import {
  applyProposal,
  createExecutionEvidence,
  createStoredProjectWithProgram,
  formatInspectorReport,
  parseStoredProject,
  serializeStoredProject,
  suggestRepeat,
  type StudioProject,
} from "./studioCore.js";

interface OpenProject {
  readonly uri: vscode.Uri;
  readonly project: StudioProject;
}

let current: OpenProject | undefined;

async function openProject(): Promise<void> {
  const [uri] =
    (await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { "Agorix project": ["json"] },
      openLabel: "Open Agorix project",
    })) ?? [];
  if (uri === undefined) {
    return;
  }
  try {
    const raw = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
    current = { uri, project: parseStoredProject(raw) };
  } catch (error) {
    await vscode.window.showErrorMessage(
      `Agorix Studio could not open this project: ${error instanceof Error ? error.message : "unknown error"}`,
    );
    return;
  }
  const document = await vscode.workspace.openTextDocument({
    content: current.project.projection.code,
    language: "javascript",
  });
  await vscode.window.showTextDocument(document);
}

function requireProject(): OpenProject | undefined {
  if (current === undefined) {
    void vscode.window.showWarningMessage("Open an Agorix project first.");
  }
  return current;
}

function showEvidence(output: vscode.OutputChannel): void {
  const open = requireProject();
  if (open === undefined) {
    return;
  }
  output.clear();
  output.appendLine(formatInspectorReport(createExecutionEvidence(open.project.stored)));
  output.show(true);
}

async function suggestRepeatCommand(): Promise<void> {
  const open = requireProject();
  if (open === undefined) {
    return;
  }
  const suggestion = suggestRepeat(open.project);
  if (suggestion === undefined) {
    await vscode.window.showInformationMessage("Nothing repeated here. No suggestion.");
    return;
  }
  const [before, after] = await Promise.all([
    vscode.workspace.openTextDocument({
      content: suggestion.diff.acceptedCode,
      language: "javascript",
    }),
    vscode.workspace.openTextDocument({
      content: suggestion.diff.proposedCode,
      language: "javascript",
    }),
  ]);
  await vscode.commands.executeCommand(
    "vscode.diff",
    before.uri,
    after.uri,
    "Agorix suggestion: use repeat",
  );
  const choice = await vscode.window.showInformationMessage(
    "Suggestion: write the repeated steps once with repeat. Your project is unchanged until you apply it.",
    "Apply",
    "Reject",
  );
  if (choice !== "Apply") {
    return;
  }
  const program = applyProposal(open.project.stored.program, suggestion.review);
  const stored = createStoredProjectWithProgram(open.project.stored, program);
  await vscode.workspace.fs.writeFile(
    open.uri,
    new TextEncoder().encode(serializeStoredProject(stored)),
  );
  current = { uri: open.uri, project: parseStoredProject(serializeStoredProject(stored)) };
  await vscode.window.showInformationMessage("Applied. Run Show Execution Evidence to check it.");
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Agorix Studio");
  context.subscriptions.push(
    output,
    vscode.commands.registerCommand("agorixStudio.openProject", openProject),
    vscode.commands.registerCommand("agorixStudio.showEvidence", () => showEvidence(output)),
    vscode.commands.registerCommand("agorixStudio.suggestRepeat", suggestRepeatCommand),
  );
}

export function deactivate(): void {
  current = undefined;
}
