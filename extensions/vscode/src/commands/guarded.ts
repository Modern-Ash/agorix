import * as vscode from "vscode";

/** Runs a command body and surfaces any failure to the learner instead of failing silently. */
export function guarded<Args extends unknown[], Result>(
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

export function reportFailure(output: vscode.OutputChannel, summary: string, error: unknown): void {
  const detail = error instanceof Error ? error.message : String(error);
  output.appendLine(`[error] ${summary}: ${detail}`);
  if (error instanceof Error && error.stack !== undefined) {
    output.appendLine(error.stack);
  }
  void vscode.window.showErrorMessage(`Agorix Studio: ${summary}. ${detail}`);
}
