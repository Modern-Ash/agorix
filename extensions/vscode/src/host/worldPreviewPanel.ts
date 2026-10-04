import * as vscode from "vscode";
import type { StudioExecutionViewState } from "../studioCore.js";
import { createNonce } from "../webview/framework.js";
import { onValidatedMessage } from "../webview/host.js";
import { renderWorldPreview, worldPreviewInboundSchemas } from "../webview/worldPreview.js";

const WORLD_PREVIEW_VIEW_TYPE = "agorixStudio.worldPreview";
let worldPreviewPanel: vscode.WebviewPanel | undefined;
let latestView: StudioExecutionViewState | undefined;

/** Opens (or reveals) Mundo Agorix, the World Preview. Webview messages are validated by the shared framework. */
export function openWorldPreviewPanel(
  view: StudioExecutionViewState,
  revealNode: (nodeId: string) => unknown,
): void {
  latestView = view;
  if (worldPreviewPanel === undefined) {
    worldPreviewPanel = vscode.window.createWebviewPanel(
      WORLD_PREVIEW_VIEW_TYPE,
      "Mundo Agorix",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [],
        retainContextWhenHidden: true,
      },
    );
    const panel = worldPreviewPanel;
    const intake = onValidatedMessage(panel.webview, {
      schemas: worldPreviewInboundSchemas,
      onMessage: async (message) => {
        if (message.type === "agorix-ready") {
          refreshWorldPreview(latestView, false);
        } else {
          await revealNode(message.nodeId);
        }
      },
    });
    panel.onDidDispose(() => {
      intake.dispose();
      worldPreviewPanel = undefined;
    });
  }
  refreshWorldPreview(view);
  worldPreviewPanel.reveal(vscode.ViewColumn.Beside, true);
}

export function refreshWorldPreview(
  view: StudioExecutionViewState | undefined,
  rerender = true,
): void {
  if (worldPreviewPanel === undefined || view === undefined) {
    return;
  }
  latestView = view;
  if (rerender) {
    worldPreviewPanel.webview.html = renderWorldPreview(
      view,
      createNonce(),
      worldPreviewPanel.webview.cspSource,
    );
  }
  void worldPreviewPanel.webview.postMessage({ type: "agorix-frame", view });
}

export function disposeWorldPreview(): void {
  worldPreviewPanel = undefined;
  latestView = undefined;
}
