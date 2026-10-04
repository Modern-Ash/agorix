import type {
  BlockEditorProjectionUpdate,
  BlockMappingEntry,
  BlockNode,
  BlockType,
  BlockWorkspaceSnapshot,
  StatementContainerPath,
  WorkspaceChange,
} from "@agorix/block-editor";
import {
  escapeJsonForScript,
  field,
  renderWebviewDocument,
  type MessageSchemas,
} from "./framework.js";

export interface StudioCanvasViewState {
  readonly workspace: BlockWorkspaceSnapshot;
  readonly blockMapping: readonly BlockMappingEntry[];
  readonly code: string;
  readonly semanticHash: string;
  readonly selectedNodeIds: readonly string[];
  readonly canUndo: boolean;
  readonly canRedo: boolean;
}

export type StudioCanvasInbound =
  | { readonly type: "agorix-canvas-ready" }
  | { readonly type: "agorix-canvas-select"; readonly nodeId: string }
  | {
      readonly type: "agorix-canvas-apply";
      readonly baseHash: string;
      readonly change: WorkspaceChange;
    }
  | { readonly type: "agorix-canvas-undo" }
  | { readonly type: "agorix-canvas-redo" };

const BLOCK_ID_PATTERN = /^[A-Za-z0-9:_./-]{1,180}$/;
const HASH_PATTERN = /^[\x20-\x7e]{1,20000}$/;
const BLOCK_TYPES = [
  "event_on_start",
  "motion_move",
  "motion_turn",
  "control_repeat",
  "control_if",
  "sensing_touching_goal",
  "literal_boolean",
  "literal_number",
] as const satisfies readonly BlockType[];

const STYLES = `
body { min-height: 100vh; }
main { display: grid; grid-template-rows: auto 1fr auto; min-height: 100vh; }
.canvas-shell { display: grid; grid-template-columns: minmax(220px, 1fr) minmax(260px, 0.72fr); min-height: 0; }
.canvas-toolbar { display: flex; gap: var(--agx-space-2); align-items: center; flex-wrap: wrap; border-bottom: 1px solid var(--agx-border); }
.canvas-button, .block-button { color: var(--agx-fg); background: var(--agx-surface); border: 1px solid var(--agx-border); border-radius: var(--agx-radius); padding: var(--agx-space-1) var(--agx-space-2); font: inherit; }
.canvas-button:hover, .block-button:hover { border-color: var(--agx-border-strong); }
.canvas-stage { overflow: auto; padding: var(--agx-space-3); border-right: 1px solid var(--agx-border); }
.script, .nested { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--agx-space-2); }
.block { display: grid; gap: var(--agx-space-1); max-width: 520px; }
.block-button { width: 100%; min-height: 34px; text-align: left; display: flex; justify-content: space-between; gap: var(--agx-space-2); }
.block-button[aria-selected="true"] { outline: 2px solid var(--agx-focus); outline-offset: 2px; }
.block-kind { color: var(--agx-link); font-family: var(--agx-font-code); }
.block-value { color: var(--agx-fg-muted); }
.nested { margin-left: var(--agx-space-3); padding-left: var(--agx-space-3); border-left: 1px solid var(--agx-border); }
.code-pane { min-width: 0; padding: var(--agx-space-3); overflow: auto; }
.code-pane pre { margin: 0; white-space: pre-wrap; font-family: var(--agx-font-code); font-size: var(--agx-type-sm); }
.hash { font-family: var(--agx-font-code); color: var(--agx-fg-muted); }
.status { color: var(--agx-fg-muted); }
@media (max-width: 720px) { .canvas-shell { grid-template-columns: 1fr; } .canvas-stage { border-right: 0; border-bottom: 1px solid var(--agx-border); } }
`;

export const studioCanvasInboundSchemas: MessageSchemas<StudioCanvasInbound> = {
  "agorix-canvas-ready": () => ({ type: "agorix-canvas-ready" }),
  "agorix-canvas-select": (raw) => {
    const nodeId = field.string(raw["nodeId"], 200, /^[A-Za-z0-9_/[\]-]+$/);
    return nodeId === undefined ? undefined : { type: "agorix-canvas-select", nodeId };
  },
  "agorix-canvas-apply": (raw) => {
    const baseHash = field.string(raw["baseHash"], 20000, HASH_PATTERN);
    const change = parseWorkspaceChange(raw["change"]);
    return baseHash === undefined || change === undefined
      ? undefined
      : { type: "agorix-canvas-apply", baseHash, change };
  },
  "agorix-canvas-undo": () => ({ type: "agorix-canvas-undo" }),
  "agorix-canvas-redo": () => ({ type: "agorix-canvas-redo" }),
};

export function createStudioCanvasViewState(
  update: BlockEditorProjectionUpdate,
  options: {
    readonly semanticHash: string;
    readonly selectedNodeIds?: readonly string[];
    readonly canUndo?: boolean;
    readonly canRedo?: boolean;
  },
): StudioCanvasViewState {
  return {
    workspace: update.workspace,
    blockMapping: update.blockMapping,
    code: update.projection.code,
    semanticHash: options.semanticHash,
    selectedNodeIds: options.selectedNodeIds ?? [],
    canUndo: options.canUndo ?? false,
    canRedo: options.canRedo ?? false,
  };
}

export function renderStudioCanvas(
  view: StudioCanvasViewState,
  nonce: string,
  cspSource: string,
): string {
  return renderWebviewDocument({
    title: "Agorix Canvas Editor",
    nonce,
    cspSource,
    styles: STYLES,
    script: SCRIPT(view),
    outboundTypes: [
      "agorix-canvas-ready",
      "agorix-canvas-select",
      "agorix-canvas-apply",
      "agorix-canvas-undo",
      "agorix-canvas-redo",
    ],
    body: `  <main>
    <header class="agx-toolbar canvas-toolbar" role="toolbar" aria-label="Canvas editing tools">
      <button class="canvas-button" type="button" data-add="motion_move">Move</button>
      <button class="canvas-button" type="button" data-add="motion_turn">Turn</button>
      <button class="canvas-button" type="button" data-add="control_repeat">Repeat</button>
      <button class="canvas-button" type="button" data-command="undo" ${view.canUndo ? "" : "disabled"}>Undo</button>
      <button class="canvas-button" type="button" data-command="redo" ${view.canRedo ? "" : "disabled"}>Redo</button>
      <span class="hash" aria-label="Semantic hash">${escapeText(view.semanticHash)}</span>
      <span id="status" class="status" role="status" aria-live="polite"></span>
    </header>
    <section class="canvas-shell">
      <div class="canvas-stage" aria-label="Canonical program canvas">
        ${renderWorkspace(view)}
      </div>
      <aside class="code-pane" aria-label="Generated read-only code projection">
        <pre><code>${escapeText(view.code)}</code></pre>
      </aside>
    </section>
    <footer class="agx-footer">Canvas blocks, code and World Preview derive from the same canonical program. POC accessibility limit: spatial arrangement remains simplified; buttons keep keyboard access for this slice.</footer>
  </main>`,
  });
}

function SCRIPT(view: StudioCanvasViewState): string {
  return `
const state = ${escapeJsonForScript(view)};
const status = document.getElementById("status");
function setStatus(message) { if (status) status.textContent = message; }
function newId(kind) { return "canvas-" + kind + "-" + Math.random().toString(36).slice(2, 10); }
function defaultBlock(kind) {
  const id = newId(kind);
  if (kind === "motion_move") return { id, type: kind, fields: { steps: 10 } };
  if (kind === "motion_turn") return { id, type: kind, fields: { degrees: 90 } };
  if (kind === "control_repeat") return { id, type: kind, fields: { count: 3 }, inputs: { body: [] } };
  return undefined;
}
function postChange(change) { agorix.post("agorix-canvas-apply", { baseHash: state.semanticHash, change }); }
document.querySelectorAll("[data-node-id]").forEach((button) => {
  button.addEventListener("click", () => {
    const nodeId = button.getAttribute("data-node-id");
    if (nodeId) agorix.post("agorix-canvas-select", { nodeId });
  });
});
document.querySelectorAll("[data-add]").forEach((button) => {
  button.addEventListener("click", () => {
    const kind = button.getAttribute("data-add");
    const block = defaultBlock(kind);
    if (!block) return;
    const script = state.workspace.scripts[0];
    const index = Array.isArray(script && script.statements) ? script.statements.length : 0;
    postChange({ type: "addBlock", container: { kind: "script", scriptIndex: 0 }, index, block });
    setStatus("Change sent for validation.");
  });
});
document.querySelectorAll("[data-edit-number]").forEach((button) => {
  button.addEventListener("click", () => {
    const blockId = button.getAttribute("data-block-id");
    const field = button.getAttribute("data-edit-number");
    const current = Number(button.getAttribute("data-current") || "0");
    const statementIndex = Number(button.getAttribute("data-statement-index"));
    const block = state.workspace.scripts[0] && state.workspace.scripts[0].statements[statementIndex];
    if (!block || !blockId || !field || !Number.isInteger(statementIndex)) return;
    const next = { ...block, fields: { ...(block.fields || {}), [field]: current + 1 } };
    postChange({ type: "editBlock", location: { container: { kind: "script", scriptIndex: 0 }, index: statementIndex }, block: next });
  });
});
document.querySelector('[data-command="undo"]')?.addEventListener("click", () => agorix.post("agorix-canvas-undo", {}));
document.querySelector('[data-command="redo"]')?.addEventListener("click", () => agorix.post("agorix-canvas-redo", {}));
agorix.on("agorix-canvas-state", (message) => {
  setStatus("Canvas synchronized with canonical program.");
  agorix.setState({ semanticHash: message.view.semanticHash, selectedNodeIds: message.view.selectedNodeIds });
});
agorix.post("agorix-canvas-ready", {});
`;
}

function renderWorkspace(view: StudioCanvasViewState): string {
  if (view.workspace.scripts.length === 0) {
    return `<p class="status">No scripts in this project.</p>`;
  }
  return view.workspace.scripts
    .map(
      (script, scriptIndex) => `<section aria-label="Script ${scriptIndex + 1}">
        <h2>When Run starts</h2>
        <ol class="script">${script.statements.map((block, index) => renderBlock(block, view, `scripts[${scriptIndex}]/statements[${index}]`, index)).join("")}</ol>
      </section>`,
    )
    .join("");
}

function renderBlock(
  block: BlockNode,
  view: StudioCanvasViewState,
  nodeId: string,
  statementIndex: number,
): string {
  const selected = view.selectedNodeIds.includes(nodeId);
  const field = numericField(block);
  const nested =
    block.type === "control_repeat"
      ? block.inputs?.body
          ?.map((child, index) => renderBlock(child, view, `${nodeId}/body[${index}]`, index))
          .join("")
      : block.type === "control_if"
        ? block.inputs?.then
            ?.map((child, index) => renderBlock(child, view, `${nodeId}/then[${index}]`, index))
            .join("")
        : "";
  return `<li class="block">
    <button class="block-button" type="button" data-node-id="${escapeAttribute(nodeId)}" aria-selected="${selected ? "true" : "false"}">
      <span class="block-kind">${escapeText(labelForBlock(block))}</span>
      <span class="block-value">${escapeText(valueForBlock(block))}</span>
    </button>
    ${field === undefined ? "" : `<button class="canvas-button" type="button" data-block-id="${escapeAttribute(block.id)}" data-edit-number="${field.name}" data-current="${field.value}" data-statement-index="${statementIndex}">+1</button>`}
    ${nested === undefined || nested.length === 0 ? "" : `<ol class="nested">${nested}</ol>`}
  </li>`;
}

function labelForBlock(block: BlockNode): string {
  switch (block.type) {
    case "motion_move":
      return "move";
    case "motion_turn":
      return "turn";
    case "control_repeat":
      return "repeat";
    case "control_if":
      return "if touching goal";
    default:
      return block.type;
  }
}

function valueForBlock(block: BlockNode): string {
  switch (block.type) {
    case "motion_move":
      return `${String(block.fields?.steps ?? "?")} steps`;
    case "motion_turn":
      return `${String(block.fields?.degrees ?? "?")} deg`;
    case "control_repeat":
      return `${String(block.fields?.count ?? "?")} times`;
    default:
      return "";
  }
}

function numericField(
  block: BlockNode,
): { readonly name: string; readonly value: number } | undefined {
  if (block.type === "motion_move" && typeof block.fields?.steps === "number")
    return { name: "steps", value: block.fields.steps };
  if (block.type === "motion_turn" && typeof block.fields?.degrees === "number")
    return { name: "degrees", value: block.fields.degrees };
  if (block.type === "control_repeat" && typeof block.fields?.count === "number")
    return { name: "count", value: block.fields.count };
  return undefined;
}

function parseWorkspaceChange(value: unknown): WorkspaceChange | undefined {
  if (!isRecord(value)) return undefined;
  if (value.type === "addBlock") {
    const container = parseContainer(value.container);
    const index = field.integer(value.index, 0, 1000);
    const block = parseBlock(value.block);
    return container === undefined || index === undefined || block === undefined
      ? undefined
      : { type: "addBlock", container, index, block };
  }
  if (value.type === "editBlock") {
    const location = parseLocation(value.location);
    const block = parseBlock(value.block);
    return location === undefined || block === undefined
      ? undefined
      : { type: "editBlock", location, block };
  }
  if (value.type === "deleteBlock") {
    const location = parseLocation(value.location);
    return location === undefined ? undefined : { type: "deleteBlock", location };
  }
  if (value.type === "moveBlock") {
    const from = parseLocation(value.from);
    const toContainer = isRecord(value.to) ? parseContainer(value.to.container) : undefined;
    const toIndex = isRecord(value.to) ? field.integer(value.to.index, 0, 1000) : undefined;
    return from === undefined || toContainer === undefined || toIndex === undefined
      ? undefined
      : { type: "moveBlock", from, to: { container: toContainer, index: toIndex } };
  }
  return undefined;
}

function parseLocation(
  value: unknown,
): { readonly container: StatementContainerPath; readonly index: number } | undefined {
  if (!isRecord(value)) return undefined;
  const container = parseContainer(value.container);
  const index = field.integer(value.index, 0, 1000);
  return container === undefined || index === undefined ? undefined : { container, index };
}

function parseContainer(value: unknown): StatementContainerPath | undefined {
  if (!isRecord(value)) return undefined;
  const kind = field.oneOf(value.kind, ["script", "repeatBody", "ifThen"] as const);
  const scriptIndex = field.integer(value.scriptIndex, 0, 100);
  if (kind === undefined || scriptIndex === undefined) return undefined;
  if (kind === "script") return { kind, scriptIndex };
  if (!Array.isArray(value.statementPath)) return undefined;
  const statementPath = value.statementPath.map((item) => field.integer(item, 0, 100));
  return statementPath.some((item) => item === undefined)
    ? undefined
    : { kind, scriptIndex, statementPath: statementPath as number[] };
}

function parseBlock(value: unknown, depth = 0): BlockNode | undefined {
  if (depth > 6 || !isRecord(value)) return undefined;
  const id = field.string(value.id, 180, BLOCK_ID_PATTERN);
  const type = field.oneOf(value.type, BLOCK_TYPES);
  if (id === undefined || type === undefined) return undefined;
  const fieldsValue = isRecord(value.fields) ? parseFields(value.fields) : undefined;
  const inputs = isRecord(value.inputs) ? parseInputs(value.inputs, depth + 1) : undefined;
  return {
    id,
    type,
    ...(fieldsValue === undefined ? {} : { fields: fieldsValue }),
    ...(inputs === undefined ? {} : { inputs }),
  };
}

function parseFields(value: Record<string, unknown>): Record<string, unknown> | undefined {
  const out: Record<string, unknown> = {};
  for (const key of ["steps", "degrees", "count"]) {
    if (value[key] !== undefined) {
      const numeric = field.integer(value[key], -10000, 10000);
      if (numeric === undefined) return undefined;
      out[key] = numeric;
    }
  }
  if (value.value !== undefined) {
    if (typeof value.value !== "boolean" && typeof value.value !== "number") return undefined;
    out.value = value.value;
  }
  return out;
}

function parseInputs(
  value: Record<string, unknown>,
  depth: number,
): BlockNode["inputs"] | undefined {
  const out: { condition?: BlockNode; body?: BlockNode[]; then?: BlockNode[] } = {};
  if (value.condition !== undefined) {
    const condition = parseBlock(value.condition, depth);
    if (condition === undefined) return undefined;
    out.condition = condition;
  }
  for (const key of ["body", "then"] as const) {
    if (value[key] !== undefined) {
      if (!Array.isArray(value[key])) return undefined;
      const blocks = value[key].map((item) => parseBlock(item, depth));
      if (blocks.some((block) => block === undefined)) return undefined;
      out[key] = blocks as BlockNode[];
    }
  }
  return out;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function escapeText(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeAttribute(value: string): string {
  return escapeText(value);
}
