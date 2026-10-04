// VS Code-facing half of the webview framework: validated host-side message intake.
import type * as vscode from "vscode";
import { validateMessage, type MessageSchemas } from "./framework.js";

export interface ValidatedMessageOptions<M extends { readonly type: string }> {
  readonly schemas: MessageSchemas<M>;
  readonly onMessage: (message: M) => void | Promise<void>;
  /** Called with a non-sensitive reason; never receives the rejected payload. */
  readonly onReject?: (reason: string) => void;
}

/** Subscribes to webview messages, dropping anything that fails validation. */
export function onValidatedMessage<M extends { readonly type: string }>(
  webview: Pick<vscode.Webview, "onDidReceiveMessage">,
  options: ValidatedMessageOptions<M>,
): vscode.Disposable {
  return webview.onDidReceiveMessage((raw: unknown) => {
    const result = validateMessage(options.schemas, raw);
    if (!result.ok) {
      options.onReject?.(result.reason);
      return;
    }
    void Promise.resolve(options.onMessage(result.message)).catch((error: unknown) => {
      void error;
      options.onReject?.("handler failed");
    });
  });
}
