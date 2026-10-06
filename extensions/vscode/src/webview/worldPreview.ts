import type { StudioExecutionViewState } from "../studioCore.js";
import {
  escapeJsonForScript,
  field,
  NODE_ID_PATTERN,
  renderWebviewDocument,
  type MessageSchemas,
} from "./framework.js";

/** Messages the World Preview webview may send to the host. */
export const STAGE_COMMANDS = ["run", "step", "reset", "stop"] as const;
export type StageCommand = (typeof STAGE_COMMANDS)[number];

export type WorldPreviewInbound =
  | { readonly type: "agorix-ready" }
  | { readonly type: "agorix-reveal-node"; readonly nodeId: string }
  | { readonly type: "agorix-command"; readonly command: StageCommand }
  | { readonly type: "agorix-select-step"; readonly index: number };

export const worldPreviewInboundSchemas: MessageSchemas<WorldPreviewInbound> = {
  "agorix-ready": () => ({ type: "agorix-ready" }),
  "agorix-reveal-node": (raw) => {
    const nodeId = field.string(raw["nodeId"], 200, NODE_ID_PATTERN);
    return nodeId === undefined ? undefined : { type: "agorix-reveal-node", nodeId };
  },
  "agorix-command": (raw) => {
    const command = field.oneOf(raw["command"], STAGE_COMMANDS);
    return command === undefined ? undefined : { type: "agorix-command", command };
  },
  "agorix-select-step": (raw) => {
    const index = field.integer(raw["index"], 0, 100_000);
    return index === undefined ? undefined : { type: "agorix-select-step", index };
  },
};

const STYLES = `
body { min-height: 100vh; }
main { display: grid; grid-template-rows: auto 1fr auto auto; min-height: 100vh; }
.world {
  position: relative;
  width: min(92vmin, 760px);
  aspect-ratio: 1;
  place-self: center;
  border: 1px solid var(--agx-border-strong);
  background:
    linear-gradient(var(--vscode-editorWidget-border, var(--agx-border)) 1px, transparent 1px),
    linear-gradient(90deg, var(--vscode-editorWidget-border, var(--agx-border)) 1px, transparent 1px),
    var(--agx-bg);
  background-size: 12.5% 12.5%;
}
.goal, .sprite {
  position: absolute;
  width: 9%;
  height: 9%;
  translate: -50% 50%;
  border: 2px solid currentColor;
  box-sizing: border-box;
}
.goal { color: var(--agx-success); border-radius: 50%; background: color-mix(in srgb, var(--agx-success), transparent 76%); }
.sprite {
  color: var(--agx-warning);
  background: color-mix(in srgb, var(--agx-warning), transparent 64%);
  clip-path: polygon(50% 0, 100% 100%, 50% 78%, 0 100%);
  transition: left 180ms ease, bottom 180ms ease, rotate 180ms ease;
}
.agx-toolbar { gap: 8px; flex-wrap: wrap; }
.agx-toolbar .agx-button[aria-pressed="true"] { outline: 1px solid var(--agx-focus, currentColor); }
.readout { font-family: var(--agx-font-code); }
.scrub { width: 100%; }
.trace { width: 100%; border-collapse: collapse; font-family: var(--agx-font-code); font-size: 12px; }
.trace th, .trace td { text-align: left; padding: 2px 8px; border-bottom: 1px solid var(--agx-border); }
.trace tr[aria-current="step"] { background: var(--vscode-list-activeSelectionBackground, transparent); }
.trace-wrap { max-height: 30vh; overflow: auto; }
.node { color: var(--agx-link); font-family: var(--agx-font-code); background: none; border: 0; padding: 0; cursor: pointer; }
`;

const SCRIPT = (view: StudioExecutionViewState): string => `
const initialView = ${escapeJsonForScript(view)};
const status = document.getElementById("status");
const step = document.getElementById("step");
const node = document.getElementById("node");
const goal = document.getElementById("goal");
const sprite = document.getElementById("sprite");
const readout = document.getElementById("readout");
const scrub = document.getElementById("scrub");
const rows = document.getElementById("rows");
let highlighted;
let stepIndexes = [];
function command(name) { agorix.post("agorix-command", { command: name }); }
document.querySelectorAll("[data-command]").forEach((button) => {
  button.addEventListener("click", () => command(button.getAttribute("data-command")));
});
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey) return;
  if (event.target && (event.target.tagName === "INPUT" || event.target.tagName === "TEXTAREA")) return;
  const map = { r: "run", s: "step", x: "stop", "0": "reset" };
  const name = map[event.key.toLowerCase()];
  if (name) { event.preventDefault(); command(name); }
});
scrub.addEventListener("change", () => {
  agorix.post("agorix-select-step", { index: Number(scrub.value) });
});
function renderTrace(view) {
  const steps = view.inspectorSteps || [];
  stepIndexes = steps.map((item) => item.frameIndex);
  const current = steps.findIndex((item) => item.frameIndex === view.selectedFrameIndex);
  scrub.max = String(Math.max(0, steps.length - 1));
  scrub.value = String(Math.max(0, current));
  scrub.disabled = steps.length < 2;
  rows.textContent = "";
  steps.forEach((item) => {
    const tr = document.createElement("tr");
    if (item.index === current) tr.setAttribute("aria-current", "step");
    const cells = [String(item.index), item.statementType || item.timing, item.summary];
    cells.forEach((text) => { const td = document.createElement("td"); td.textContent = text; tr.appendChild(td); });
    const td = document.createElement("td");
    if (item.nodeId) {
      const button = document.createElement("button");
      button.type = "button"; button.className = "node"; button.textContent = item.nodeId;
      button.addEventListener("click", () => agorix.post("agorix-reveal-node", { nodeId: item.nodeId }));
      td.appendChild(button);
    }
    tr.appendChild(td);
    tr.addEventListener("click", () => agorix.post("agorix-select-step", { index: item.index }));
    rows.appendChild(tr);
  });
}
function place(element, point, viewport) {
  element.style.left = (point.x / viewport.width) * 100 + "%";
  element.style.bottom = (point.y / viewport.height) * 100 + "%";
}
function render(view) {
  const frame = view.currentFrame || view.previewFrames[0];
  if (!frame) return;
  status.textContent = view.status.toUpperCase();
  step.textContent = "frame " + (view.selectedFrameIndex + 1) + "/" + view.previewFrames.length;
  highlighted = frame.highlightedNodeId;
  node.textContent = highlighted ? highlighted : "run";
  node.disabled = !highlighted;
  place(goal, frame.state.goal, frame.state.viewport);
  place(sprite, frame.state.sprite, frame.state.viewport);
  sprite.style.rotate = (-frame.state.sprite.heading) + "deg";
  const sp = frame.state.sprite;
  readout.textContent = "x " + Number(sp.x.toFixed(2)) + "  y " + Number(sp.y.toFixed(2)) + "  dir " + Number(sp.heading.toFixed(2)) + "°";
  renderTrace(view);
  agorix.setState({ selectedFrameIndex: view.selectedFrameIndex });
}
node.addEventListener("click", () => {
  if (highlighted) agorix.post("agorix-reveal-node", { nodeId: highlighted });
});
const syncEl = document.getElementById("sync");
agorix.on("agorix-sync", (message) => {
  syncEl.textContent = message.failedNodeId
    ? "failed at " + message.failedNodeId
    : message.selectedNodeId ? "selected " + message.selectedNodeId : "";
});
render(initialView);
agorix.on("agorix-frame", (message) => render(message.view));
agorix.post("agorix-ready", {});
`;

export function renderWorldPreview(
  view: StudioExecutionViewState,
  nonce: string,
  cspSource: string,
): string {
  return renderWebviewDocument({
    title: "Mundo Agorix",
    nonce,
    cspSource,
    styles: STYLES,
    script: SCRIPT(view),
    outboundTypes: ["agorix-ready", "agorix-reveal-node", "agorix-command", "agorix-select-step"],
    body: `  <main>
    <header class="agx-toolbar" role="status" aria-live="polite">
      <strong id="status"></strong>
      <span id="step" class="agx-muted"></span>
      <span id="readout" class="readout"></span>
      <span id="sync" class="agx-muted"></span>
      <span role="group" aria-label="Execution controls">
        <button class="agx-button" type="button" data-command="run" aria-keyshortcuts="R">Run</button>
        <button class="agx-button" type="button" data-command="step" aria-keyshortcuts="S">Step</button>
        <button class="agx-button" type="button" data-command="stop" aria-keyshortcuts="X">Stop</button>
        <button class="agx-button" type="button" data-command="reset" aria-keyshortcuts="0">Reset</button>
      </span>
      <button id="node" class="node" type="button" aria-label="Reveal highlighted node in code"></button>
    </header>
    <section class="world" aria-label="Agorix shared runtime world preview">
      <div class="goal" id="goal" role="img" aria-label="goal"></div>
      <div class="sprite" id="sprite" role="img" aria-label="sprite"></div>
    </section>
    <section aria-label="Execution trace">
      <input id="scrub" class="scrub" type="range" min="0" max="0" value="0" aria-label="Execution step" />
      <div class="trace-wrap">
        <table class="trace">
          <thead><tr><th scope="col">#</th><th scope="col">Statement</th><th scope="col">Effect</th><th scope="col">Node</th></tr></thead>
          <tbody id="rows"></tbody>
        </table>
      </div>
    </section>
    <footer class="agx-footer">Rendered from @agorix/stage frames produced by the canonical runtime.</footer>
  </main>`,
  });
}
