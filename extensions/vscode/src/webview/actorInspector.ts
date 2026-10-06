import type { ProjectActors } from "@agorix/persistence";
import {
  escapeJsonForScript,
  field,
  renderWebviewDocument,
  type MessageSchemas,
} from "./framework.js";

/** Editable actor properties the Inspector may send; each value is validated before use. */
export interface ActorPatchMessage {
  readonly type: "agorix-actor-patch";
  readonly name?: string;
  readonly x?: number;
  readonly y?: number;
  readonly direction?: number;
  readonly size?: number;
  readonly visible?: boolean;
}

export type ActorInspectorInbound = { readonly type: "agorix-ready" } | ActorPatchMessage;

const NUMBER_FIELDS = ["x", "y", "direction", "size"] as const;

function finite(value: unknown, min: number, max: number): number | undefined {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max
    ? value
    : undefined;
}

export const actorInspectorInboundSchemas: MessageSchemas<ActorInspectorInbound> = {
  "agorix-ready": () => ({ type: "agorix-ready" }),
  "agorix-actor-patch": (raw) => {
    const patch: { -readonly [K in keyof ActorPatchMessage]?: ActorPatchMessage[K] } = {
      type: "agorix-actor-patch",
    };
    let count = 0;
    if ("name" in raw) {
      const name = field.string(raw["name"], 40);
      if (name === undefined || name.trim() === "") return undefined;
      patch.name = name;
      count += 1;
    }
    for (const key of NUMBER_FIELDS) {
      if (!(key in raw)) continue;
      const value =
        key === "size"
          ? finite(raw[key], 5, 500)
          : key === "direction"
            ? finite(raw[key], -3600, 3600)
            : finite(raw[key], -10_000, 10_000);
      if (value === undefined) return undefined;
      patch[key] = value;
      count += 1;
    }
    if ("visible" in raw) {
      if (typeof raw["visible"] !== "boolean") return undefined;
      patch.visible = raw["visible"];
      count += 1;
    }
    return count === 0 ? undefined : (patch as ActorPatchMessage);
  },
};

const STYLES = `
main { max-width: 560px; }
table { width: 100%; border-collapse: collapse; }
th { text-align: left; font-weight: 600; width: 38%; padding: 4px 8px 4px 0; }
td { padding: 2px 0; }
input[type="text"], input[type="number"] { width: 100%; box-sizing: border-box; }
.assets { font-family: var(--agx-font-code); }
.error { color: var(--agx-error); min-height: 1.2em; }
`;

const SCRIPT = (actors: ProjectActors): string => `
let state = ${escapeJsonForScript(actors)};
const form = document.getElementById("form");
const errorEl = document.getElementById("error");
const assets = document.getElementById("assets");
function active() { return state.items.find((a) => a.id === state.activeId) || state.items[0]; }
function render() {
  const actor = active();
  for (const key of ["name", "x", "y", "direction", "size"]) {
    const input = form.elements[key];
    if (document.activeElement !== input) input.value = actor[key];
  }
  form.elements.visible.checked = actor.visible;
  assets.textContent = "costume " + (actor.costume || "default") +
    "  ·  backdrop " + (state.backdrop || "default") +
    "  ·  sounds " + ((state.sounds || []).join(", ") || "none");
}
function send(key, value) {
  errorEl.textContent = "";
  agorix.post("agorix-actor-patch", { [key]: value });
}
form.addEventListener("change", (event) => {
  const el = event.target;
  if (!(el instanceof HTMLInputElement)) return;
  if (el.name === "visible") return send("visible", el.checked);
  if (el.name === "name") return send("name", el.value);
  const value = Number(el.value);
  if (el.value.trim() === "" || !Number.isFinite(value)) {
    errorEl.textContent = el.name + " must be a number";
    return;
  }
  send(el.name, value);
});
form.addEventListener("submit", (event) => event.preventDefault());
agorix.on("agorix-actors", (message) => { state = message.actors; errorEl.textContent = ""; render(); });
agorix.on("agorix-actor-error", (message) => { errorEl.textContent = message.reason; });
render();
agorix.post("agorix-ready", {});
`;

export function renderActorInspector(
  actors: ProjectActors,
  nonce: string,
  cspSource: string,
): string {
  const row = (name: string, label: string, type: string, extra = "") =>
    `<tr><th scope="row"><label for="f-${name}">${label}</label></th><td><input id="f-${name}" name="${name}" type="${type}" ${extra}></td></tr>`;
  return renderWebviewDocument({
    title: "Actor Inspector",
    nonce,
    cspSource,
    styles: STYLES,
    script: SCRIPT(actors),
    outboundTypes: ["agorix-ready", "agorix-actor-patch"],
    body: `  <main>
    <h1>Actor Inspector</h1>
    <form id="form" aria-label="Actor properties">
      <table>
        ${row("name", "Name", "text", 'maxlength="40"')}
        ${row("x", "x", "number", 'step="any"')}
        ${row("y", "y", "number", 'step="any"')}
        ${row("direction", "Direction (°)", "number", 'step="any"')}
        ${row("size", "Size (%)", "number", 'min="5" max="500" step="any"')}
        <tr><th scope="row"><label for="f-visible">Visible</label></th><td><input id="f-visible" name="visible" type="checkbox"></td></tr>
      </table>
    </form>
    <p id="error" class="error" role="alert"></p>
    <p id="assets" class="assets agx-muted" aria-label="Assets in use"></p>
  </main>`,
  });
}
