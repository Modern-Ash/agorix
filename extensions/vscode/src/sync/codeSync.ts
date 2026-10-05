import * as vscode from "vscode";
import {
  nodeIdForProjectionLine,
  projectionRangeForNode,
  type StudioProjectionDocument,
} from "../studioCore.js";
import { PROJECTION_SCHEME } from "../store/session.js";
import type { SyncHub } from "./syncHub.js";

export interface CodeSyncOptions {
  readonly hub: SyncHub;
  currentProjection(): StudioProjectionDocument | undefined;
  revealCanonicalNode(nodeId: string): Promise<void>;
}

const SELECT_DEBOUNCE_MS = 150;

function offsetToPosition(text: string, offset: number): vscode.Position {
  const lines = text.slice(0, offset).split("\n");
  return new vscode.Position(lines.length - 1, lines.at(-1)?.length ?? 0);
}

/** Code editor side of live sync: selection producer, reveal and execution decorations consumer. */
export function registerCodeSync(options: CodeSyncOptions): vscode.Disposable {
  const executing = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor("editor.findMatchHighlightBackground"),
    after: { contentText: "  ◀ running", color: new vscode.ThemeColor("descriptionForeground") },
  });
  const failed = vscode.window.createTextEditorDecorationType({
    isWholeLine: true,
    backgroundColor: new vscode.ThemeColor("inputValidation.errorBackground"),
    after: { contentText: "  ✖ failed here", color: new vscode.ThemeColor("errorForeground") },
  });
  let timer: NodeJS.Timeout | undefined;

  const rangeFor = (nodeId: string | undefined): vscode.Range | undefined => {
    const projection = options.currentProjection();
    if (projection === undefined || nodeId === undefined) return undefined;
    try {
      const range = projectionRangeForNode(projection, nodeId);
      return new vscode.Range(
        offsetToPosition(projection.text, range.start),
        offsetToPosition(projection.text, range.end),
      );
    } catch {
      return undefined;
    }
  };

  const decorate = (): void => {
    const state = options.hub.getState();
    const exec = rangeFor(state.executingNodeId);
    const fail = rangeFor(state.failedNodeId);
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.scheme !== PROJECTION_SCHEME) continue;
      editor.setDecorations(executing, exec === undefined ? [] : [exec]);
      editor.setDecorations(failed, fail === undefined ? [] : [fail]);
    }
  };

  const unsubscribe = options.hub.subscribe(
    (state, source) => {
      decorate();
      if (state.selectedNodeId !== undefined && source !== "runtime") {
        void options.revealCanonicalNode(state.selectedNodeId);
      }
    },
    { ignoreSource: "code" },
  );

  const selection = vscode.window.onDidChangeTextEditorSelection((event) => {
    if (event.textEditor.document.uri.scheme !== PROJECTION_SCHEME) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      const projection = options.currentProjection();
      if (projection === undefined) return;
      const nodeId = nodeIdForProjectionLine(projection, event.selections[0]?.active.line ?? 0);
      if (nodeId !== undefined && nodeId !== options.hub.getState().selectedNodeId) {
        options.hub.select(nodeId, "code");
      }
    }, SELECT_DEBOUNCE_MS);
  });

  return vscode.Disposable.from(executing, failed, selection, {
    dispose: () => {
      clearTimeout(timer);
      unsubscribe();
    },
  });
}
