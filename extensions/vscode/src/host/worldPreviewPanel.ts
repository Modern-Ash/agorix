import * as vscode from "vscode";
import type { StudioExecutionViewState } from "../studioCore.js";

const WORLD_PREVIEW_VIEW_TYPE = "agorixStudio.worldPreview";
let worldPreviewPanel: vscode.WebviewPanel | undefined;

export function openWorldPreviewPanel(view: StudioExecutionViewState): void {
  if (worldPreviewPanel === undefined) {
    worldPreviewPanel = vscode.window.createWebviewPanel(
      WORLD_PREVIEW_VIEW_TYPE,
      "Agorix World Preview",
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        localResourceRoots: [],
        retainContextWhenHidden: true,
      },
    );
    worldPreviewPanel.onDidDispose(() => {
      worldPreviewPanel = undefined;
    });
  }
  refreshWorldPreview(view);
  worldPreviewPanel.reveal(vscode.ViewColumn.Beside, true);
}

export function refreshWorldPreview(view: StudioExecutionViewState | undefined): void {
  if (worldPreviewPanel === undefined || view === undefined) {
    return;
  }
  const nonce = nonceForWebview();
  worldPreviewPanel.webview.html = worldPreviewHtml(
    nonce,
    worldPreviewPanel.webview.cspSource,
    view,
  );
  void worldPreviewPanel.webview.postMessage({ type: "agorix-frame", view });
}

export function disposeWorldPreview(): void {
  worldPreviewPanel = undefined;
}

function nonceForWebview(): string {
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 36).toString(36)).join("");
}

function escapedJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export function worldPreviewHtml(
  nonce: string,
  cspSource: string,
  view: StudioExecutionViewState,
): string {
  const data = escapedJson(view);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data:; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Agorix World Preview</title>
  <style nonce="${nonce}">
    :root {
      color-scheme: light dark;
      --goal: var(--vscode-testing-iconPassed, #2e7d32);
      --sprite: var(--vscode-editorWarning-foreground, #c77700);
      --trail: var(--vscode-focusBorder, #007acc);
    }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
    }
    main {
      display: grid;
      grid-template-rows: auto 1fr auto;
      min-height: 100vh;
    }
    header,
    footer {
      padding: 10px 14px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }
    footer {
      border-top: 1px solid var(--vscode-panel-border);
      border-bottom: 0;
      color: var(--vscode-descriptionForeground);
    }
    .world {
      position: relative;
      width: min(92vmin, 760px);
      aspect-ratio: 1;
      place-self: center;
      border: 1px solid var(--vscode-panel-border);
      background:
        linear-gradient(var(--vscode-editorWidget-border, rgba(127,127,127,.18)) 1px, transparent 1px),
        linear-gradient(90deg, var(--vscode-editorWidget-border, rgba(127,127,127,.18)) 1px, transparent 1px),
        var(--vscode-editor-background);
      background-size: 12.5% 12.5%;
    }
    .goal,
    .sprite {
      position: absolute;
      width: 9%;
      height: 9%;
      translate: -50% 50%;
      border: 2px solid currentColor;
      box-sizing: border-box;
    }
    .goal {
      color: var(--goal);
      border-radius: 50%;
      background: color-mix(in srgb, var(--goal), transparent 76%);
    }
    .sprite {
      color: var(--sprite);
      background: color-mix(in srgb, var(--sprite), transparent 64%);
      clip-path: polygon(50% 0, 100% 100%, 50% 78%, 0 100%);
      transition: left 180ms ease, bottom 180ms ease, rotate 180ms ease;
    }
    .node {
      color: var(--vscode-textLink-foreground);
      font-family: var(--vscode-editor-font-family);
    }
    @media (prefers-reduced-motion: reduce) {
      .sprite {
        transition: none;
      }
    }
  </style>
</head>
<body>
  <main>
    <header>
      <strong id="status"></strong>
      <span id="step"></span>
      <span class="node" id="node"></span>
    </header>
    <section class="world" aria-label="Agorix shared runtime world preview">
      <div class="goal" id="goal" aria-label="goal"></div>
      <div class="sprite" id="sprite" aria-label="sprite"></div>
    </section>
    <footer id="provenance">Rendered from @agorix/stage frames produced by the canonical runtime.</footer>
  </main>
  <script nonce="${nonce}">
    const initialView = ${data};
    const vscode = acquireVsCodeApi();
    const status = document.getElementById("status");
    const step = document.getElementById("step");
    const node = document.getElementById("node");
    const goal = document.getElementById("goal");
    const sprite = document.getElementById("sprite");
    function place(element, point, viewport) {
      const x = (point.x / viewport.width) * 100;
      const y = (point.y / viewport.height) * 100;
      element.style.left = x + "%";
      element.style.bottom = y + "%";
    }
    function render(view) {
      const frame = view.currentFrame || view.previewFrames[0];
      if (!frame) return;
      status.textContent = view.status.toUpperCase() + " ";
      step.textContent = "frame " + (view.selectedFrameIndex + 1) + "/" + view.previewFrames.length;
      node.textContent = frame.highlightedNodeId ? " · " + frame.highlightedNodeId : " · run";
      place(goal, frame.state.goal, frame.state.viewport);
      place(sprite, frame.state.sprite, frame.state.viewport);
      sprite.style.rotate = (-frame.state.sprite.heading) + "deg";
      vscode.setState({ selectedFrameIndex: view.selectedFrameIndex });
    }
    render(initialView);
    window.addEventListener("message", (event) => {
      if (event.data && event.data.type === "agorix-frame") render(event.data.view);
    });
  </script>
</body>
</html>`;
}
