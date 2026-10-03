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

/**
 * Opens a stored project. An explicit `uri` argument (command palette callers,
 * Explorer context, integration tests) skips the file picker.
 */
async function openProject(target?: unknown): Promise<void> {
  const uri =
    target instanceof vscode.Uri
      ? target
      : ((await vscode.window.showOpenDialog({
          canSelectMany: false,
          filters: { "Agorix project": ["json"] },
          openLabel: "Open Agorix project",
        })) ?? [])[0];
  if (uri === undefined) {
    return;
  }
  try {
    const raw = new TextDecoder().decode(await vscode.workspace.fs.readFile(uri));
    current = { uri, project: parseStoredProject(raw) };
  } catch (error) {
    // Do not await: a toast resolves only when dismissed and would hang the command.
    void vscode.window.showErrorMessage(
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

function showEvidence(output: vscode.OutputChannel): string | undefined {
  const open = requireProject();
  if (open === undefined) {
    return undefined;
  }
  const report = formatInspectorReport(createExecutionEvidence(open.project.stored));
  output.clear();
  output.appendLine(report);
  output.show(true);
  return report;
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

/** Runs a command body and surfaces any failure to the learner instead of failing silently. */
function guarded<Args extends unknown[], Result>(
  output: vscode.OutputChannel,
  name: string,
  body: (...args: Args) => Result | Promise<Result>,
): (...args: Args) => Promise<Result | undefined> {
  return async (...args) => {
    try {
      return await body(...args);
    } catch (error) {
      reportFailure(output, `${name} failed`, error);
      return undefined;
    }
  };
}

function reportFailure(output: vscode.OutputChannel, summary: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  output.appendLine(`[error] ${summary}: ${detail}`);
  if (error instanceof Error && error.stack !== undefined) {
    output.appendLine(error.stack);
  }
  void vscode.window.showErrorMessage(`Agorix Studio: ${summary}. ${detail}`);
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("Agorix Studio");
  context.subscriptions.push(output);
  try {
    context.subscriptions.push(
      vscode.commands.registerCommand(
        "agorixStudio.openProject",
        guarded(output, "Open Project", openProject),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.showEvidence",
        guarded(output, "Show Execution Evidence", () => showEvidence(output)),
      ),
      vscode.commands.registerCommand(
        "agorixStudio.suggestRepeat",
        guarded(output, "Suggest repeat", suggestRepeatCommand),
      ),
    );
  } catch (error) {
    reportFailure(output, "activation failed", error);
    output.show(true);
    throw error;
  }
}

export function deactivate(): void {
  current = undefined;
}
