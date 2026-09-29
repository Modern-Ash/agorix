import * as vscode from "vscode";

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("agorixStudio.openProject", () =>
      vscode.window.showInformationMessage("Agorix Studio is ready to open shared projects."),
    ),
    vscode.commands.registerCommand("agorixStudio.showEvidence", () =>
      vscode.window.showInformationMessage("Agorix Studio execution evidence uses shared runtime."),
    ),
  );
}

export function deactivate(): void {
  // No background resources are started by the first Studio slice.
}
