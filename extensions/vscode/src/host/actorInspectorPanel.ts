import * as vscode from "vscode";
import type { ProjectActors } from "@agorix/persistence";
import { createNonce } from "../webview/framework.js";
import { onValidatedMessage } from "../webview/host.js";
import {
  actorInspectorInboundSchemas,
  renderActorInspector,
  type ActorPatchMessage,
} from "../webview/actorInspector.js";

let panel: vscode.WebviewPanel | undefined;
let latest: ProjectActors | undefined;

export interface ActorInspectorHost {
  /** Applies a validated patch; resolves to the new actors or a refusal reason. */
  readonly applyPatch: (
    patch: Omit<ActorPatchMessage, "type">,
  ) => Promise<ProjectActors | { readonly error: string }>;
}

export function openActorInspectorPanel(actors: ProjectActors, host: ActorInspectorHost): void {
  latest = actors;
  if (panel === undefined) {
    panel = vscode.window.createWebviewPanel(
      "agorixStudio.actorInspector",
      "Actor Inspector",
      vscode.ViewColumn.Beside,
      { enableScripts: true, localResourceRoots: [], retainContextWhenHidden: true },
    );
    const current = panel;
    const intake = onValidatedMessage(current.webview, {
      schemas: actorInspectorInboundSchemas,
      onMessage: async (message) => {
        if (message.type === "agorix-ready") {
          refreshActorInspector(latest, false);
          return;
        }
        const patch: Record<string, unknown> = { ...message };
        delete patch["type"];
        const result = await host.applyPatch(patch as Omit<typeof message, "type">);
        if ("error" in result) {
          void current.webview.postMessage({ type: "agorix-actor-error", reason: result.error });
        }
      },
    });
    current.onDidDispose(() => {
      intake.dispose();
      panel = undefined;
    });
  }
  refreshActorInspector(actors);
  panel.reveal(vscode.ViewColumn.Beside, true);
}

export function refreshActorInspector(actors: ProjectActors | undefined, rerender = true): void {
  if (panel === undefined || actors === undefined) return;
  latest = actors;
  if (rerender) {
    panel.webview.html = renderActorInspector(actors, createNonce(), panel.webview.cspSource);
  }
  void panel.webview.postMessage({ type: "agorix-actors", actors });
}

export function disposeActorInspector(): void {
  panel = undefined;
  latest = undefined;
}
