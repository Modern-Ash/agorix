import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import { SCHEMA_VERSION } from "@agorix/program-model";
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
import {
  createExecutionEvidence,
  createExecutionViewState,
  type StudioExecutionViewState,
} from "../studioCore.js";

const VIEW_TYPE = "agorixStudio.workbench";
let panel: vscode.WebviewPanel | undefined;
let host: WorkbenchHost | undefined;
let agent: AgentHost | undefined;
let blockCounter = 0;
let currentHub: SyncHub | undefined;
let currentExecutionView: (() => StudioExecutionViewState | undefined) | undefined;
let currentPort: HostPort | undefined;
let unsubscribeSync: (() => void) | undefined;

let lastDensity: Density | undefined;
let configListener: vscode.Disposable | undefined;

function clearWorkbenchState(): void {
  currentPort = undefined;
  configListener?.dispose();
  configListener = undefined;
  lastDensity = undefined;
  unsubscribeSync?.();
  unsubscribeSync = undefined;
  panel = undefined;
  host = undefined;
  agent = undefined;
  currentExecutionView = undefined;
}

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

function historyMessage(port: HostPort): HostMessage {
  return { schema: STUDIO_PROTOCOL_VERSION, type: "historyState", ...port.historyState() };
}

function executionMessages(view: unknown): HostMessage[] {
  const candidate = view as Partial<StudioExecutionViewState> | undefined;
  if (
    candidate === undefined ||
    (candidate.status !== "idle" &&
      candidate.status !== "running" &&
      candidate.status !== "stopped" &&
      candidate.status !== "completed") ||
    (candidate.outcome !== "completed" &&
      candidate.outcome !== "budget-exceeded" &&
      candidate.outcome !== "stopped") ||
    typeof candidate.selectedFrameIndex !== "number" ||
    typeof candidate.stepsUsed !== "number" ||
    !Array.isArray(candidate.previewFrames)
  ) {
    return [];
  }
  const messages: HostMessage[] = [
    {
      schema: STUDIO_PROTOCOL_VERSION,
      type: "executionState",
      status: candidate.status,
      outcome: candidate.outcome,
      frameIndex: candidate.selectedFrameIndex,
      frameCount: candidate.previewFrames.length,
      stepsUsed: candidate.stepsUsed,
      ...(Array.isArray(candidate.eventTrace) ? { eventTrace: candidate.eventTrace } : {}),
    },
  ];
  if (candidate.currentFrame !== undefined) {
    messages.push({
      schema: STUDIO_PROTOCOL_VERSION,
      type: "stageFrame",
      frame: {
        state: candidate.currentFrame.state,
        frameIndex: candidate.selectedFrameIndex,
        frameCount: candidate.previewFrames.length,
        step: candidate.currentFrame.step,
        running: candidate.currentFrame.running,
        reachedGoal: candidate.currentFrame.reachedGoal,
        ...(candidate.currentFrame.actorId === undefined
          ? {}
          : { actorId: candidate.currentFrame.actorId }),
        ...(candidate.currentFrame.scriptId === undefined
          ? {}
          : { scriptId: candidate.currentFrame.scriptId }),
        ...(candidate.currentFrame.statementType === undefined
          ? {}
          : { statementType: candidate.currentFrame.statementType }),
        ...(candidate.currentFrame.highlightedNodeId === undefined
          ? {}
          : { highlightedNodeId: candidate.currentFrame.highlightedNodeId }),
      },
    });
  }
  return messages;
}

function initialStageMessages(port: HostPort): HostMessage[] {
  const program = port.getProgram();
  const metadata = port.getMetadata();
  if (program === undefined || metadata === undefined) return [];
  try {
    const evidence = createExecutionEvidence({ schemaVersion: SCHEMA_VERSION, program, metadata });
    return executionMessages(createExecutionViewState(evidence, 0, "idle")).filter(
      (message) => message.type === "stageFrame",
    );
  } catch {
    return [];
  }
}

export function openWorkbenchPanel(
  context: vscode.ExtensionContext,
  port: HostPort,
  agentPort: AgentPort,
  hub: SyncHub,
  executionView: () => StudioExecutionViewState | undefined,
  locale: WorkbenchLocale = "en",
): void {
  if (panel !== undefined) {
    panel.reveal(vscode.ViewColumn.Active, false);
    return;
  }
  const distRoot = vscode.Uri.file(context.asAbsolutePath("dist"));
  attachWorkbenchPanel(
    context,
    vscode.window.createWebviewPanel(VIEW_TYPE, "Agorix Studio · Ori", vscode.ViewColumn.Active, {
      enableScripts: true,
      localResourceRoots: [distRoot],
      retainContextWhenHidden: true,
    }),
    port,
    agentPort,
    hub,
    executionView,
    locale,
  );
}

export function attachWorkbenchPanel(
  context: vscode.ExtensionContext,
  targetPanel: vscode.WebviewPanel,
  port: HostPort,
  agentPort: AgentPort,
  hub: SyncHub,
  executionView: () => StudioExecutionViewState | undefined,
  locale: WorkbenchLocale = "en",
): void {
  if (panel !== undefined) {
    if (panel === targetPanel) {
      panel.reveal(vscode.ViewColumn.Beside, true);
      return;
    }
    panel.dispose();
    clearWorkbenchState();
  }
  const distRoot = vscode.Uri.file(context.asAbsolutePath("dist"));
  panel = targetPanel;
  panel.webview.options = {
    enableScripts: true,
    localResourceRoots: [distRoot],
  };
  host = createWorkbenchHost(port, () => `block:wb_${(blockCounter += 1)}`);
  agent = createAgentHost(agentPort);
  currentHub = hub;
  currentExecutionView = executionView;
  currentPort = port;
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
      if (message.type === "executionCommand") {
        const view = await vscode.commands.executeCommand(`agorixStudio.${message.command}`);
        await send(executionMessages(view));
        return;
      }
      if (message.type === "openCode") {
        await vscode.commands.executeCommand("agorixStudio.openProjection");
        return;
      }
      if (message.type === "historyCommand") {
        await vscode.commands.executeCommand(
          message.command === "undo" ? "agorixStudio.undoProposal" : "agorixStudio.redoProposal",
        );
        await send([historyMessage(port)]);
        return;
      }
      if (message.type === "stageEvent") {
        const view = port.runStageEvent?.(
          message.event === "keyPressed"
            ? { type: "keyPressed", key: message.key }
            : { type: "actorClicked", actorId: message.actorId },
        );
        await send(executionMessages(view));
        return;
      }
      if (message.type === "ready") {
        await send(await workbench.handle(message));
        await send([historyMessage(port)]);
        await send(agentHost.snapshot());
        await send(workbench.syncMessage(hub.getState()));
        await send(
          executionView() === undefined
            ? initialStageMessages(port)
            : executionMessages(executionView()),
        );
        await pushDensity("setting", true);
        return;
      }
      if (message.type === "agreementsChanged") {
        // The agent host owns the loop, but the session (ambient offers, Companion, commands) must
        // see the same agreements: forward them to the session as well.
        await workbench.handle(message);
      }
      const agentMessages = await agentHost.handle(message);
      if (agentMessages !== undefined) {
        await send(agentMessages);
      } else {
        const result = await workbench.handle(message);
        await send(result);
        if (
          (message.type === "updateActor" ||
            message.type === "updateStage" ||
            message.type === "createActor" ||
            message.type === "deleteActor" ||
            message.type === "createScript") &&
          !result.some((item) => item.type === "error")
        ) {
          const refreshed = await vscode.commands.executeCommand("agorixStudio.reset");
          await send(executionMessages(refreshed));
        }
        if (message.type === "updateMissionSpec") {
          await send(agentHost.onProgramChanged());
        }
      }
      await pushDensity("auto");
    })().catch(() => {
      void vscode.window.showErrorMessage(
        "Agorix Studio could not save this change. The project was not modified.",
      );
    });
  });
  panel.onDidDispose(() => {
    clearWorkbenchState();
  });
}

export function refreshWorkbench(): void {
  if (host !== undefined && agent !== undefined) {
    const messages = [
      ...host.snapshot(),
      ...(currentPort === undefined ? [] : [historyMessage(currentPort)]),
      ...agent.onProgramChanged(),
      ...(currentHub === undefined ? [] : host.syncMessage(currentHub.getState())),
      ...(currentExecutionView?.() === undefined
        ? currentPort === undefined
          ? []
          : initialStageMessages(currentPort)
        : executionMessages(currentExecutionView?.())),
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
  clearWorkbenchState();
  currentHub = undefined;
}
