import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import { parseUiMessage, type HostMessage } from "@agorix/studio-protocol";
import type { ProactiveDecision, StudioSignal } from "@agorix/learning-decision-plane";
import { workbenchHtml, type WorkbenchDensity, type WorkbenchLocale } from "./workbenchHtml.js";
import { createAgentHost, type AgentHost, type AgentPort } from "./agentHost.js";
import type { SyncHub } from "../sync/syncHub.js";
import { createWorkbenchHost, type HostPort, type WorkbenchHost } from "./workbenchHost.js";

const VIEW_TYPE = "agorixStudio.workbench";
let panel: vscode.WebviewPanel | undefined;
let host: WorkbenchHost | undefined;
let agent: AgentHost | undefined;
let blockCounter = 0;
let currentHub: SyncHub | undefined;
let unsubscribeSync: (() => void) | undefined;

function configuredDensity(): WorkbenchDensity {
  const value = vscode.workspace
    .getConfiguration("agorixStudio")
    .get<string>("workbench.density", "comfortable");
  return value === "compact" ? "compact" : "comfortable";
}

async function send(messages: readonly HostMessage[]): Promise<void> {
  for (const message of messages) {
    await panel?.webview.postMessage(message);
  }
}

export function openWorkbenchPanel(
  context: vscode.ExtensionContext,
  port: HostPort,
  agentPort: AgentPort,
  hub: SyncHub,
  locale: WorkbenchLocale = "en",
): void {
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
  agent = createAgentHost(agentPort);
  currentHub = hub;
  unsubscribeSync = hub.subscribe((state) => {
    if (host !== undefined) void send(host.syncMessage(state));
  });
  const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(distRoot, "workbench.js"));
  panel.webview.html = workbenchHtml(
    randomBytes(16).toString("hex"),
    panel.webview.cspSource,
    scriptUri.toString(),
    configuredDensity(),
    locale,
  );
  panel.webview.onDidReceiveMessage((raw: unknown) => {
    const message = parseUiMessage(raw);
    if (message === undefined || host === undefined || agent === undefined) {
      return;
    }
    const workbench = host;
    const agentHost = agent;
    void (async () => {
      if (message.type === "ready") {
        await send(await workbench.handle(message));
        await send(agentHost.snapshot());
        await send(workbench.syncMessage(hub.getState()));
        return;
      }
      await send((await agentHost.handle(message)) ?? (await workbench.handle(message)));
    })().catch(() => undefined);
  });
  panel.onDidDispose(() => {
    unsubscribeSync?.();
    unsubscribeSync = undefined;
    panel = undefined;
    host = undefined;
    agent = undefined;
  });
}

export function refreshWorkbench(): void {
  if (host !== undefined && agent !== undefined) {
    const messages = [
      ...host.snapshot(),
      ...agent.onProgramChanged(),
      ...(currentHub === undefined ? [] : host.syncMessage(currentHub.getState())),
    ];
    void send(messages);
  }
}

export function publishWorkbenchAmbientHint(
  signal: StudioSignal,
  decision: ProactiveDecision,
): void {
  if (host !== undefined) {
    void send(host.ambientHint(signal, decision));
  }
}

export function clearWorkbenchAmbientHint(): void {
  if (host !== undefined) {
    void send(host.clearAmbientHint());
  }
}

export function disposeWorkbench(): void {
  unsubscribeSync?.();
  unsubscribeSync = undefined;
  currentHub = undefined;
  panel = undefined;
  host = undefined;
  agent = undefined;
}
