import type { StudioExecutionViewState } from "../studioCore.js";
import {
  escapeJsonForScript,
  field,
  NODE_ID_PATTERN,
  renderWebviewDocument,
  type MessageSchemas,
} from "./framework.js";

/** Messages the World Preview webview may send to the host. */
export type WorldPreviewInbound =
  | { readonly type: "agorix-ready" }
  | { readonly type: "agorix-reveal-node"; readonly nodeId: string };

export const worldPreviewInboundSchemas: MessageSchemas<WorldPreviewInbound> = {
  "agorix-ready": () => ({ type: "agorix-ready" }),
  "agorix-reveal-node": (raw) => {
    const nodeId = field.string(raw["nodeId"], 200, NODE_ID_PATTERN);
    return nodeId === undefined ? undefined : { type: "agorix-reveal-node", nodeId };
  },
};

const STYLES = `
body { min-height: 100vh; }
main { display: grid; grid-template-rows: auto 1fr auto; min-height: 100vh; }
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
.node { color: var(--agx-link); font-family: var(--agx-font-code); background: none; border: 0; padding: 0; cursor: pointer; }
`;

const SCRIPT = (view: StudioExecutionViewState): string => `
const initialView = ${escapeJsonForScript(view)};
const status = document.getElementById("status");
const step = document.getElementById("step");
const node = document.getElementById("node");
const goal = document.getElementById("goal");
const sprite = document.getElementById("sprite");
let highlighted;
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
  agorix.setState({ selectedFrameIndex: view.selectedFrameIndex });
}
node.addEventListener("click", () => {
  if (highlighted) agorix.post("agorix-reveal-node", { nodeId: highlighted });
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
    title: "Agorix World Preview",
    nonce,
    cspSource,
    styles: STYLES,
    script: SCRIPT(view),
    outboundTypes: ["agorix-ready", "agorix-reveal-node"],
    body: `  <main>
    <header class="agx-toolbar" role="status" aria-live="polite">
      <strong id="status"></strong>
      <span id="step" class="agx-muted"></span>
      <button id="node" class="node" type="button" aria-label="Reveal highlighted node in code"></button>
    </header>
    <section class="world" aria-label="Agorix shared runtime world preview">
      <div class="goal" id="goal" role="img" aria-label="goal"></div>
      <div class="sprite" id="sprite" role="img" aria-label="sprite"></div>
    </section>
    <footer class="agx-footer">Rendered from @agorix/stage frames produced by the canonical runtime.</footer>
  </main>`,
  });
}
