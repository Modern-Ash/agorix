import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import { parseUiMessage, type HostMessage } from "@agorix/studio-protocol";
import { workbenchHtml } from "./workbenchHtml.js";
import { createWorkbenchHost, type HostPort, type WorkbenchHost } from "./workbenchHost.js";

const VIEW_TYPE = "agorixStudio.workbench";
let panel: vscode.WebviewPanel | undefined;
let host: WorkbenchHost | undefined;
let blockCounter = 0;

async function send(messages: readonly HostMessage[]): Promise<void> {
  for (const message of messages) {
    await panel?.webview.postMessage(message);
  }
}

export function openWorkbenchPanel(context: vscode.ExtensionContext, port: HostPort): void {
  if (panel !== undefined) {
    panel.reveal(vscode.ViewColumn.Beside, true);
    return;
  }
  const distRoot = vscode.Uri.file(context.asAbsolutePath("dist"));
  panel = vscode.window.createWebviewPanel(
    VIEW_TYPE,
    "Agorix Workbench",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      localResourceRoots: [distRoot],
      retainContextWhenHidden: true,
    },
  );
  host = createWorkbenchHost(port, () => `block:wb_${(blockCounter += 1)}`);
  const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(distRoot, "workbench.js"));
  panel.webview.html = workbenchHtml(
    randomBytes(16).toString("hex"),
    panel.webview.cspSource,
    scriptUri.toString(),
  );
  panel.webview.onDidReceiveMessage((raw: unknown) => {
    const message = parseUiMessage(raw);
    if (message === undefined || host === undefined) {
      return;
    }
    void host.handle(message).then(send, () => undefined);
  });
  panel.onDidDispose(() => {
    panel = undefined;
    host = undefined;
  });
}

export function refreshWorkbench(): void {
  if (host !== undefined) {
    void send(host.snapshot());
  }
}

export function disposeWorkbench(): void {
  panel = undefined;
  host = undefined;
}
