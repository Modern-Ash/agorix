import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import {
  STUDIO_PROTOCOL_VERSION,
  normalizeDensityPreference,
  parseUiMessage,
  resolveDensity,
  type Density,
  type DensityPreference,
  type HostMessage,
} from "@agorix/studio-protocol";
import type { ProactiveDecision, StudioSignal } from "@agorix/learning-decision-plane";
import { workbenchHtml, type WorkbenchLocale } from "./workbenchHtml.js";
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

let lastDensity: Density | undefined;
let configListener: vscode.Disposable | undefined;

function densityPreference(): DensityPreference {
  return normalizeDensityPreference(
    vscode.workspace.getConfiguration("agorixStudio").get<string>("workbench.density", "auto"),
  );
}

function currentDensity(): Density {
  return resolveDensity(
    densityPreference(),
    host?.experience() ?? { edits: 0, reachedGoal: false },
  );
}

/** Tells the webview the layout when it changes; `auto` changes are announced to the learner. */
async function pushDensity(reason: "auto" | "setting", force = false): Promise<void> {
  if (host === undefined) return;
  const value = currentDensity();
  if (!force && value === lastDensity) return;
  lastDensity = value;
  await send([{ schema: STUDIO_PROTOCOL_VERSION, type: "density", value, reason }]);
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
  lastDensity = undefined;
  unsubscribeSync = hub.subscribe((state) => {
    if (host !== undefined) void send(host.syncMessage(state));
  });
  const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(distRoot, "workbench.js"));
  panel.webview.html = workbenchHtml(
    randomBytes(16).toString("hex"),
    panel.webview.cspSource,
    scriptUri.toString(),
    currentDensity(),
    locale,
  );
  lastDensity = currentDensity();
  configListener = vscode.workspace.onDidChangeConfiguration((event) => {
    if (event.affectsConfiguration("agorixStudio.workbench.density")) {
      void pushDensity("setting");
    }
  });
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
        await pushDensity("setting", true);
        return;
      }
      await send((await agentHost.handle(message)) ?? (await workbench.handle(message)));
      await pushDensity("auto");
    })().catch(() => undefined);
  });
  panel.onDidDispose(() => {
    configListener?.dispose();
    configListener = undefined;
    lastDensity = undefined;
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
    void send(messages).then(() => pushDensity("auto"));
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
  configListener?.dispose();
  configListener = undefined;
  lastDensity = undefined;
  unsubscribeSync?.();
  unsubscribeSync = undefined;
  currentHub = undefined;
  panel = undefined;
  host = undefined;
  agent = undefined;
}
