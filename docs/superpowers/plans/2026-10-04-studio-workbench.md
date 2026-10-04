# Studio Workbench (Plan B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a first Workbench webview in Agorix Studio: an icon-first palette and a block canvas with drag and drop (and keyboard equivalents), driven entirely by the headless core from Plan A and mutating the program only through the host's canonical write path.

**Architecture:** A new React package `@agorix/studio-ui` renders a `BlockWorkspaceSnapshot` and turns gestures into `Intent`s via `@agorix/interaction-core`; it talks to a host through `@agorix/studio-protocol` messages over a `HostBridge`. In the extension, a pure `workbenchHost` (injected `HostPort`) applies intents with `@agorix/block-editor`, and a thin vscode adapter owns the `WebviewPanel`, CSP and message wiring. The existing `extension.ts` is touched only to inject the port; modularizing it is a separate plan.

**Tech Stack:** TypeScript, React 18, esbuild (webview bundle), vitest, `react-dom/server` for render tests, VS Code `WebviewPanel`.

**Spec:** `docs/superpowers/specs/2026-10-04-studio-refactor-design.md` (D1-D3, D5 anchors; ADR 0007). Plan A (merged) provides `interaction-core`, `agent-workflow`, `studio-protocol`.

## Global Constraints

- Domain/shared packages must not import `vscode`; only `extensions/vscode` may (`scripts/vscode-boundary.test.mjs`).
- A UI never mutates the program; the host converts intents to canonical transactions and writes through the existing write path (`writeCurrentProject` plus undo snapshot, as `applyActiveProposal` does).
- No gesture applies an AI proposal; `reviewProposal` only opens review. `decideProposal` messages are ignored by this host.
- Every drag has a keyboard/button equivalent (`docs/product/INPUT_PARITY_MATRIX.md`).
- Webview CSP: `default-src 'none'`, script and style by nonce only, no inline `style=` attributes, `localResourceRoots` limited to the extension `media` folder.
- Code stays visible: opening the Workbench must not close or replace the projection editor; it opens beside it (`vscode.ViewColumn.Beside`).
- Everything works with the agent disabled; `askAgent` intents answer `agentUnavailable` until the agent plan lands.
- Identifiers on the wire follow `/^[A-Za-z0-9][A-Za-z0-9_.:-]{0,63}$/`; program hashes follow `/^[A-Za-z0-9:_-]{1,128}$/`.
- Code passes `pnpm lint`, `pnpm format:check`, `pnpm test`, `pnpm build`; the packaged VSIX smoke (`test:vsix`) must still pass.
- Commits end with `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.

## Review Focus

- A canvas edit that would break the program (nesting depth, node limits, non-statement insert) must show an error message and leave the project file byte-for-byte unchanged.
- Undo after a Workbench edit must restore the previous file using the same undo stack as proposals; redo is cleared by a new edit.
- A webview message that is malformed, oversize or from an unknown schema is ignored without throwing in the host.
- Switching or closing the project while the Workbench is open must clear or refresh it, never show a stale program.
- The Workbench webview must carry no remote resources and no inline event handlers (CSP violation would blank it).
- Dropping a block onto its own position or the adjacent slot must not corrupt order.
- Re-opening the Workbench when it is already open reveals the existing panel instead of creating a second one.

## Rulings carried from the spec

- **WebviewPanel now, custom editor later.** The spec names a custom editor. `.agorix` projects are opened by `openProject` and written through `workspace.fs` with an app-level undo stack; a `CustomTextEditorProvider` would fight that. This plan opens the Workbench as a `WebviewPanel` beside the code (same pattern as World Preview). A custom editor for `*.agorix` is a later plan. Cost if wrong: one provider swap; `studio-ui` and `workbenchHost` are unchanged by it.
- **No modularization of `extension.ts` here.** The module-level state is shared by the existing 20 tests' mocks. This plan adds modules and one injection point. The split into `host/`, `commands/`, `store/` is Plan B2, done under the existing tests as the safety net.

---

## File structure

| Path                                             | Responsibility                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| `packages/studio-protocol/src/index.ts` (modify) | Add `workspace` and `error` host messages and a strict workspace parser     |
| `packages/studio-ui/src/blockView.ts`            | Pure: workspace -> render rows (blocks and drop slots with container paths) |
| `packages/studio-ui/src/bridge.ts`               | `HostBridge` type                                                           |
| `packages/studio-ui/src/Palette.tsx`             | Icon-first draggable palette with button equivalents                        |
| `packages/studio-ui/src/Canvas.tsx`              | Block list, drop slots, keyboard handling, agent drop zones                 |
| `packages/studio-ui/src/Workbench.tsx`           | State, layout, aria-live status                                             |
| `packages/studio-ui/src/styles.ts`               | Workbench CSS string using VS Code theme variables                          |
| `packages/studio-ui/src/index.ts`                | exports incl. `mountWorkbench`                                              |
| `extensions/vscode/src/host/workbenchHost.ts`    | Pure host: `HostPort`, intent handling, snapshot                            |
| `extensions/vscode/src/host/workbenchPanel.ts`   | vscode adapter: panel, CSP html, message wiring                             |
| `extensions/vscode/webview/main.tsx`             | Webview entry (`acquireVsCodeApi`, mount)                                   |
| `extensions/vscode/webview/tsconfig.json`        | DOM+JSX typecheck for the webview entry                                     |
| `extensions/vscode/scripts/bundle.mjs` (modify)  | Second bundle `media/workbench.js`                                          |
| `extensions/vscode/src/extension.ts` (modify)    | Inject `HostPort`, `openWorkbench` command, refresh on change               |

---

### Task 1: Protocol: workspace and error host messages

**Files:**

- Modify: `packages/studio-protocol/src/index.ts`, `packages/studio-protocol/src/index.test.ts`, `packages/studio-protocol/package.json` (add `@agorix/block-editor` dependency)

**Interfaces:**

- Consumes: `BlockWorkspaceSnapshot`, `BlockNode`, `BlockScript` from `@agorix/block-editor`.
- Produces: `HostMessage` gains `{schema; type:"workspace"; workspace: BlockWorkspaceSnapshot; programHash: string}` and `{schema; type:"error"; code: "INVALID_CHANGE" | "INVALID_PROGRAM"}`; `parseHostMessage` validates them strictly (script count <= 64, nesting depth <= 16, known block types, safe field values).

- [ ] **Step 1: Add the dependency**

In `packages/studio-protocol/package.json` add `"@agorix/block-editor": "workspace:*"` to `dependencies`. Run `pnpm install`.

- [ ] **Step 2: Extend the types and parser**

In `packages/studio-protocol/src/index.ts` add the import `import type { BlockNode, BlockScript, BlockType, BlockWorkspaceSnapshot } from "@agorix/block-editor";`, extend `HostMessage` with the two members above, and add:

```ts
const HASH_PATTERN = /^[A-Za-z0-9:_-]{1,128}$/;
const MAX_SCRIPTS = 64;
const MAX_DEPTH = 16;
const MAX_NODES = 2000;

function parseBlock(
  value: unknown,
  depth: number,
  budget: { nodes: number },
): BlockNode | undefined {
  if (!isObject(value) || depth > MAX_DEPTH || (budget.nodes -= 1) < 0) {
    return undefined;
  }
  const { id, type } = value;
  if (typeof id !== "string" || id.length === 0 || id.length > 128) {
    return undefined;
  }
  if (!(BLOCK_TYPES as readonly unknown[]).includes(type)) {
    return undefined;
  }
  const out: {
    id: string;
    type: BlockType;
    fields?: Record<string, unknown>;
    inputs?: BlockNode["inputs"];
  } = {
    id,
    type: type as BlockType,
  };
  const fields = value["fields"];
  if (fields !== undefined) {
    if (!isObject(fields)) {
      return undefined;
    }
    const safe: Record<string, unknown> = {};
    for (const [key, field] of Object.entries(fields)) {
      if (typeof field !== "number" && typeof field !== "boolean" && typeof field !== "string") {
        return undefined;
      }
      safe[key] = field;
    }
    out.fields = safe;
  }
  const inputs = value["inputs"];
  if (inputs !== undefined) {
    if (!isObject(inputs)) {
      return undefined;
    }
    const parsed: { body?: BlockNode[]; then?: BlockNode[]; condition?: BlockNode } = {};
    for (const key of ["body", "then"] as const) {
      const list = inputs[key];
      if (list !== undefined) {
        const blocks = parseBlockList(list, depth + 1, budget);
        if (blocks === undefined) {
          return undefined;
        }
        parsed[key] = blocks;
      }
    }
    if (inputs["condition"] !== undefined) {
      const condition = parseBlock(inputs["condition"], depth + 1, budget);
      if (condition === undefined) {
        return undefined;
      }
      parsed.condition = condition;
    }
    out.inputs = parsed;
  }
  return out;
}

function parseBlockList(
  value: unknown,
  depth: number,
  budget: { nodes: number },
): BlockNode[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const blocks: BlockNode[] = [];
  for (const item of value) {
    const block = parseBlock(item, depth, budget);
    if (block === undefined) {
      return undefined;
    }
    blocks.push(block);
  }
  return blocks;
}

function parseWorkspace(value: unknown): BlockWorkspaceSnapshot | undefined {
  if (
    !isObject(value) ||
    !Array.isArray(value["scripts"]) ||
    value["scripts"].length > MAX_SCRIPTS
  ) {
    return undefined;
  }
  const budget = { nodes: MAX_NODES };
  const scripts: BlockScript[] = [];
  for (const raw of value["scripts"] as unknown[]) {
    if (!isObject(raw) || typeof raw["id"] !== "string") {
      return undefined;
    }
    const trigger = parseBlock(raw["trigger"], 0, budget);
    const statements = parseBlockList(raw["statements"], 0, budget);
    if (trigger === undefined || statements === undefined) {
      return undefined;
    }
    const programId = raw["programId"];
    scripts.push({
      id: raw["id"],
      ...(typeof programId === "string" ? { programId } : {}),
      trigger,
      statements,
    });
  }
  return { scripts };
}
```

In `parseHostMessage` add cases:

```ts
    case "workspace": {
      const workspace = parseWorkspace(value["workspace"]);
      const hash = value["programHash"];
      return workspace !== undefined && typeof hash === "string" && HASH_PATTERN.test(hash)
        ? { schema, type: "workspace", workspace, programHash: hash }
        : undefined;
    }
    case "error":
      return value["code"] === "INVALID_CHANGE" || value["code"] === "INVALID_PROGRAM"
        ? { schema, type: "error", code: value["code"] }
        : undefined;
```

- [ ] **Step 3: Add tests to `index.test.ts`**

Append a `describe("workspace messages")` that: (a) round-trips `createStarterWorkspace()` from `@agorix/block-editor` with `programHash: "abc123"`; (b) returns `undefined` for an unknown block type, 65 scripts, nesting deeper than 16 (build with a loop), a non-primitive field value, and a hash with a space; (c) round-trips `{ type: "error", code: "INVALID_CHANGE" }` and rejects `code: "x"`.

- [ ] **Step 4: Verify and commit**

Run: `pnpm prettier --write packages/studio-protocol && pnpm --filter @agorix/studio-protocol test && pnpm --filter @agorix/studio-protocol build`
Expected: PASS.

```bash
git add packages/studio-protocol pnpm-lock.yaml
git commit -m "feat(studio-protocol): workspace and error host messages with strict parsing

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 2: `studio-ui` block view model

**Files:**

- Create: `packages/studio-ui/package.json`, `tsconfig.json`, `vitest.config.ts`, `src/blockView.ts`, `src/blockView.test.ts`, `src/bridge.ts`, `src/index.ts`

**Interfaces:**

- Consumes: `BlockNode`, `BlockWorkspaceSnapshot`, `StatementContainerPath`, `StatementLocation`, `getBlockDefinition` from `@agorix/block-editor`; `InsertionPoint` from `@agorix/interaction-core`.
- Produces:
  - `type RenderRow = { kind: "script"; scriptIndex: number } | { kind: "slot"; slot: InsertionPoint; depth: number } | { kind: "block"; block: RenderBlock; depth: number }`
  - `interface RenderBlock { id: string; type: BlockType; label: string; location: StatementLocation; siblingCount: number; fields: Readonly<Record<string, unknown>> }`
  - `toRows(workspace: BlockWorkspaceSnapshot): RenderRow[]`
  - `interface HostBridge { post(message: UiMessage): void; subscribe(listener: (message: HostMessage) => void): () => void }`

- [ ] **Step 1: Scaffold**

`package.json`:

```json
{
  "name": "@agorix/studio-ui",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run --config vitest.config.ts"
  },
  "dependencies": {
    "@agorix/block-editor": "workspace:*",
    "@agorix/interaction-core": "workspace:*",
    "@agorix/studio-protocol": "workspace:*",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1"
  }
}
```

`tsconfig.json`: extend `../../tsconfig.base.json` with `"jsx": "react-jsx"`, `"lib": ["ES2022", "DOM"]`, `outDir: dist`, `rootDir: src`, `include: ["src"]`. `vitest.config.ts` as in the other packages. Run `pnpm install`.

- [ ] **Step 2: Implement `bridge.ts` and `blockView.ts`**

```ts
// bridge.ts
import type { HostMessage, UiMessage } from "@agorix/studio-protocol";

export interface HostBridge {
  post(message: UiMessage): void;
  subscribe(listener: (message: HostMessage) => void): () => void;
}
```

```ts
// blockView.ts
import {
  getBlockDefinition,
  type BlockNode,
  type BlockType,
  type BlockWorkspaceSnapshot,
  type StatementContainerPath,
  type StatementLocation,
} from "@agorix/block-editor";
import type { InsertionPoint } from "@agorix/interaction-core";

export interface RenderBlock {
  readonly id: string;
  readonly type: BlockType;
  readonly label: string;
  readonly location: StatementLocation;
  readonly siblingCount: number;
  readonly fields: Readonly<Record<string, unknown>>;
}

export type RenderRow =
  | { readonly kind: "script"; readonly scriptIndex: number }
  | { readonly kind: "slot"; readonly slot: InsertionPoint; readonly depth: number }
  | { readonly kind: "block"; readonly block: RenderBlock; readonly depth: number };

function pushList(
  rows: RenderRow[],
  list: readonly BlockNode[],
  container: StatementContainerPath,
  scriptIndex: number,
  path: readonly number[],
  depth: number,
): void {
  rows.push({ kind: "slot", slot: { container, index: 0 }, depth });
  list.forEach((node, index) => {
    rows.push({
      kind: "block",
      depth,
      block: {
        id: node.id,
        type: node.type,
        label: getBlockDefinition(node.type)?.label ?? node.type,
        location: { container, index },
        siblingCount: list.length,
        fields: node.fields ?? {},
      },
    });
    const childPath = [...path, index];
    if (node.type === "control_repeat") {
      pushList(
        rows,
        node.inputs?.body ?? [],
        { kind: "repeatBody", scriptIndex, statementPath: childPath },
        scriptIndex,
        childPath,
        depth + 1,
      );
    } else if (node.type === "control_if") {
      pushList(
        rows,
        node.inputs?.then ?? [],
        { kind: "ifThen", scriptIndex, statementPath: childPath },
        scriptIndex,
        childPath,
        depth + 1,
      );
    }
    rows.push({ kind: "slot", slot: { container, index: index + 1 }, depth });
  });
}

/** Slot index n means "insert so the block ends up at position n"; the last slot appends. */
export function toRows(workspace: BlockWorkspaceSnapshot): RenderRow[] {
  const rows: RenderRow[] = [];
  workspace.scripts.forEach((script, scriptIndex) => {
    rows.push({ kind: "script", scriptIndex });
    const container: StatementContainerPath = { kind: "script", scriptIndex };
    pushList(rows, script.statements, container, scriptIndex, [], 0);
  });
  return rows;
}
```

Note the duplicate slot at index 0 and `index + 1` of the previous block share a position; to avoid adjacent duplicate slots, change `pushList` so the leading slot is pushed only when `list.length === 0`, and each block is followed by its slot at `index + 1`, with the leading slot (index 0) pushed before the first block. Keep exactly one slot between any two blocks and one before the first: that is the code above except the initial push, which stays; the per-block trailing push covers the rest. Verify with the test below that no two slots are adjacent.

`index.ts`:

```ts
export const PACKAGE_NAME = "@agorix/studio-ui";
export type { HostBridge } from "./bridge.js";
export type { RenderBlock, RenderRow } from "./blockView.js";
export { toRows } from "./blockView.js";
```

- [ ] **Step 3: Test**

`blockView.test.ts`: build a program via `programToWorkspace` of `{ schema: "agorix/program/v1", scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [{ type: "move", steps: 3 }, { type: "repeat", count: 2, body: [{ type: "turn", degrees: 90 }] }] }] }` and assert: first row is `script`; rows alternate slot/block with no two adjacent slots at the same depth; the repeat body rows have `depth 1` and a `repeatBody` container with `statementPath: [1]`; an empty script yields exactly `[script, slot]`; the last top-level slot has `index` equal to `statements.length`.

- [ ] **Step 4: Verify and commit**

Run: `pnpm prettier --write packages/studio-ui && pnpm --filter @agorix/studio-ui test && pnpm --filter @agorix/studio-ui build`
Expected: PASS.

```bash
git add packages/studio-ui pnpm-lock.yaml
git commit -m "feat(studio-ui): block view model and host bridge

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 3: `studio-ui` components

**Files:**

- Create: `packages/studio-ui/src/Palette.tsx`, `Canvas.tsx`, `Workbench.tsx`, `styles.ts`, `mount.tsx`, `src/components.test.tsx`
- Modify: `packages/studio-ui/src/index.ts`

**Interfaces:**

- Consumes: `toRows`, `HostBridge` (Task 2); `resolveDrop`, `keyboardIntent`, `DragSource`, `DropTarget`, `AgentVerb`, `Intent` from `@agorix/interaction-core`; `POC_TOOLBOX` from `@agorix/block-editor`; `parseHostMessage`-typed `HostMessage`.
- Produces: `Workbench({ bridge })` component, `mountWorkbench(root: HTMLElement, bridge: HostBridge): () => void`, `WORKBENCH_CSS: string`.

- [ ] **Step 1: Implement the components**

Behavior to implement (write the TSX accordingly):

- `Workbench` holds `{ workspace?: BlockWorkspaceSnapshot; programHash?: string; status: string }`. It subscribes to the bridge: `workspace` messages replace the workspace and set status `"Updated"`; `error` messages set status to a short learner-safe sentence per code (`INVALID_CHANGE`: "That change would break the program, so nothing changed."; `INVALID_PROGRAM`: "The program could not be shown."); `agentUnavailable` sets "The agent is not available right now." It posts `{ schema: STUDIO_PROTOCOL_VERSION, type: "ready" }` on mount. It renders `<Palette/>`, `<Canvas/>`, three `AgentZone`s and a `<div role="status" aria-live="polite">` with the status text.
- `Palette` renders one `<button>` per block in `POC_TOOLBOX` except placement `trigger` (use `getBlockDefinition(type)?.placement !== "trigger"`), each `draggable`, `aria-label` = `accessibleName`, visible label = `label`. `onDragStart` sets `dataTransfer` type `application/x-agorix-drag` to `JSON.stringify({ kind: "palette", blockType })`. `onClick` posts an `insertBlock` intent appended to the end of script 0: `{ container: { kind: "script", scriptIndex: 0 }, index: <statements.length of script 0> }`.
- `Canvas` renders `toRows(workspace)`. `script` rows render a heading "Script N: when you press Run". `slot` rows render a drop target `<div>` (`aria-hidden="true"`, class `slot`) with `onDragOver` (`preventDefault`) and `onDrop` that parses the drag payload as `DragSource`, calls `resolveDrop(source, { kind: "slot", to: slot })` and posts the intent if defined. `block` rows render a focusable `<div role="group" tabIndex={0} draggable>` showing label and numeric fields, `aria-keyshortcuts="Alt+ArrowUp Alt+ArrowDown Delete"`, indentation by a CSS class `depth-N` (no inline style). `onDragStart` sets `{ kind: "block", nodeId: block.id, location: block.location }`. `onKeyDown`: map `Alt+ArrowUp`, `Alt+ArrowDown`, `Delete` to `keyboardIntent(chord, { location, siblingCount })` and post when defined, calling `preventDefault`. Each block also has Up, Down and Delete `<button>`s (always visible) posting the same `keyboardIntent` results.
- `AgentZone({ verb })` is a drop target labelled "Explain", "Debug" or "Challenge" that resolves `resolveDrop(source, { kind: "agent", verb })` and posts the intent.
- Intent posting helper: `bridge.post({ schema: STUDIO_PROTOCOL_VERSION, type: "intent", intent })`.
- `styles.ts` exports `WORKBENCH_CSS` using only `var(--vscode-*)` colors, a two-column grid (palette left, canvas right), `.slot` height 8px growing to 24px on `.drag-over`, `.depth-0..4` left padding classes, visible focus outline using `var(--vscode-focusBorder)`, and `@media (prefers-reduced-motion: reduce)` removing transitions.
- `mount.tsx`: `mountWorkbench(root, bridge)` uses `createRoot(root).render(<Workbench bridge={bridge} />)` and returns `() => root.unmount()` via the created root.

Update `index.ts` exports: `Workbench`, `mountWorkbench`, `WORKBENCH_CSS`.

- [ ] **Step 2: Render and behavior tests**

`components.test.tsx` uses `renderToStaticMarkup` from `react-dom/server` and a fake bridge (`post` pushes to an array, `subscribe` stores the listener):

- Palette markup contains each non-trigger block's accessible name and does not contain the trigger block.
- `Canvas` markup for a two-statement workspace contains two elements with `tabindex="0"`, `aria-keyshortcuts`, and the slot count equals blocks + 1.
- Pure handler tests: export small pure functions from the components module and test them without a DOM: `dragPayload(source): string`, `parseDragPayload(raw: string): DragSource | undefined` (returns `undefined` for invalid JSON or unknown `kind`), `chordFromEvent({ altKey, key }): KeyChord | undefined`. Assert `chordFromEvent({ altKey: true, key: "ArrowUp" })` is `"Alt+ArrowUp"`, `{ altKey: false, key: "ArrowUp" }` is `undefined`, `{ altKey: false, key: "Delete" }` is `"Delete"`, and `parseDragPayload("{")` is `undefined`.
- Status mapping: a function `statusFor(message: HostMessage): string | undefined` returns the learner-safe sentences above for `error` and `agentUnavailable`.

- [ ] **Step 3: Verify and commit**

Run: `pnpm prettier --write packages/studio-ui && pnpm --filter @agorix/studio-ui test && pnpm --filter @agorix/studio-ui build && pnpm lint`
Expected: PASS.

```bash
git add packages/studio-ui
git commit -m "feat(studio-ui): palette, canvas and workbench components

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Pure `workbenchHost`

**Files:**

- Create: `extensions/vscode/src/host/workbenchHost.ts`, `extensions/vscode/src/host/workbenchHost.test.ts`
- Modify: `extensions/vscode/package.json` (add dependencies `@agorix/block-editor`, `@agorix/interaction-core`, `@agorix/studio-protocol`, `@agorix/studio-ui`, `@agorix/agent-workflow` as `workspace:*`)

**Interfaces:**

- Consumes: `applyWorkspaceChange`, `programToWorkspace`, `BlockEditorAdapterError` (`@agorix/block-editor`); `intentToChange`, `Intent` (`@agorix/interaction-core`); `STUDIO_PROTOCOL_VERSION`, `UiMessage`, `HostMessage` (`@agorix/studio-protocol`); `programSemanticHash` (`@agorix/proposals`); `ProgramValidationError`, `ProjectProgram` (`@agorix/program-model`).
- Produces:

```ts
export interface HostPort {
  getProgram(): ProjectProgram | undefined;
  commit(program: ProjectProgram, label: string): Promise<void>;
  openProposalReview(proposalId: string): Promise<void>;
  reveal(nodeId: string): Promise<void>;
}
export interface WorkbenchHost {
  handle(message: UiMessage): Promise<HostMessage[]>;
  snapshot(): HostMessage[];
}
export function createWorkbenchHost(port: HostPort, newBlockId: () => string): WorkbenchHost;
```

- [ ] **Step 1: Implement**

```ts
import {
  BlockEditorAdapterError,
  applyWorkspaceChange,
  programToWorkspace,
} from "@agorix/block-editor";
import { intentToChange } from "@agorix/interaction-core";
import { ProgramValidationError, type ProjectProgram } from "@agorix/program-model";
import { programSemanticHash } from "@agorix/proposals";
import { STUDIO_PROTOCOL_VERSION, type HostMessage, type UiMessage } from "@agorix/studio-protocol";

export interface HostPort {
  getProgram(): ProjectProgram | undefined;
  commit(program: ProjectProgram, label: string): Promise<void>;
  openProposalReview(proposalId: string): Promise<void>;
  reveal(nodeId: string): Promise<void>;
}

export interface WorkbenchHost {
  handle(message: UiMessage): Promise<HostMessage[]>;
  snapshot(): HostMessage[];
}

const schema = STUDIO_PROTOCOL_VERSION;

export function createWorkbenchHost(port: HostPort, newBlockId: () => string): WorkbenchHost {
  function snapshot(): HostMessage[] {
    const program = port.getProgram();
    if (program === undefined) {
      return [];
    }
    try {
      const { workspace } = programToWorkspace(program);
      return [{ schema, type: "workspace", workspace, programHash: programSemanticHash(program) }];
    } catch (error) {
      if (error instanceof BlockEditorAdapterError || error instanceof ProgramValidationError) {
        return [{ schema, type: "error", code: "INVALID_PROGRAM" }];
      }
      throw error;
    }
  }

  async function handle(message: UiMessage): Promise<HostMessage[]> {
    switch (message.type) {
      case "ready":
        return snapshot();
      case "intent": {
        const intent = message.intent;
        if (intent.type === "revealNode") {
          await port.reveal(intent.nodeId);
          return [];
        }
        if (intent.type === "reviewProposal") {
          await port.openProposalReview(intent.proposalId);
          return [];
        }
        if (intent.type === "askAgent") {
          return [{ schema, type: "agentUnavailable" }];
        }
        const change = (() => {
          try {
            return intentToChange(intent, newBlockId);
          } catch {
            return undefined;
          }
        })();
        const program = port.getProgram();
        if (change === undefined || program === undefined) {
          return [];
        }
        try {
          const { workspace } = programToWorkspace(program);
          const updated = applyWorkspaceChange(workspace, change);
          await port.commit(updated.program, `Workbench: ${intent.type}`);
        } catch (error) {
          if (error instanceof BlockEditorAdapterError || error instanceof ProgramValidationError) {
            return [{ schema, type: "error", code: "INVALID_CHANGE" }];
          }
          throw error;
        }
        return snapshot();
      }
      case "decideProposal":
      case "agreementsChanged":
        return [];
    }
  }

  return { handle, snapshot };
}
```

Intents `highlightNodes` fall through `intentToChange` to `undefined` and return `[]`.

- [ ] **Step 2: Tests**

`workbenchHost.test.ts` with an in-memory `HostPort` (program variable, `commit` assigns it and records labels, spies for `reveal`/`openProposalReview`) using the same `{ schema: "agorix/program/v1", ... }` program shape as Task 2:

- `ready` returns one `workspace` message whose `programHash` equals `programSemanticHash(program)`; with no program returns `[]`.
- An `insertBlock` intent (`motion_move` at index 0) commits a program with one more statement, label starts with `Workbench:`, and returns a `workspace` message with the new hash.
- A `moveBlock` intent from index 0 to index 1 reorders statements; the resulting hash equals the hash of applying the same `WorkspaceChange` directly with `applyWorkspaceChange` (parity with the block-editor path).
- An `insertBlock` of `event_on_start` returns `[{ type: "error", code: "INVALID_CHANGE" }]` and `commit` was not called (program unchanged).
- A move whose `from.index` is out of range returns the same error and does not commit.
- `revealNode` calls `reveal`; `reviewProposal` calls `openProposalReview`; `askAgent` returns `agentUnavailable`; `decideProposal` returns `[]` and does not commit.
- `highlightNodes` returns `[]`.

- [ ] **Step 3: Verify and commit**

Run: `pnpm install && pnpm prettier --write extensions/vscode/src/host && pnpm --filter agorix-studio test && pnpm --filter agorix-studio typecheck`
Expected: PASS (the package name is `agorix-studio`; confirm with the `name` field in `extensions/vscode/package.json` and use it).

```bash
git add extensions/vscode pnpm-lock.yaml
git commit -m "feat(studio): pure workbench host applying intents through block-editor

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Webview panel, bundle and wiring

**Files:**

- Create: `extensions/vscode/src/host/workbenchPanel.ts`, `extensions/vscode/webview/main.tsx`, `extensions/vscode/webview/tsconfig.json`
- Modify: `extensions/vscode/scripts/bundle.mjs`, `extensions/vscode/.vscodeignore`, `extensions/vscode/package.json` (command, activation event, build script), `extensions/vscode/src/extension.ts`, `extensions/vscode/src/extension.test.ts`, `extensions/vscode/media/` (generated bundle is git-ignored)

**Interfaces:**

- Consumes: `createWorkbenchHost`, `HostPort` (Task 4); `parseUiMessage` (`@agorix/studio-protocol`); `mountWorkbench`, `WORKBENCH_CSS` (`@agorix/studio-ui`).
- Produces: command `agorixStudio.openWorkbench`; `openWorkbenchPanel(context, port): void` and `refreshWorkbench(): void` exported from `workbenchPanel.ts`.

- [ ] **Step 1: Webview entry**

`extensions/vscode/webview/main.tsx`:

```tsx
import { mountWorkbench, type HostBridge } from "@agorix/studio-ui";
import { parseHostMessage } from "@agorix/studio-protocol";

declare function acquireVsCodeApi(): { postMessage(message: unknown): void };

const api = acquireVsCodeApi();
const bridge: HostBridge = {
  post: (message) => api.postMessage(message),
  subscribe: (listener) => {
    const handler = (event: MessageEvent) => {
      const message = parseHostMessage(event.data);
      if (message !== undefined) {
        listener(message);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  },
};

const root = document.getElementById("root");
if (root !== null) {
  mountWorkbench(root, bridge);
}
```

`webview/tsconfig.json`: extends `../../../tsconfig.base.json` with `noEmit: true`, `jsx: "react-jsx"`, `lib: ["ES2022","DOM"]`, `include: ["./**/*.tsx"]`.

- [ ] **Step 2: Bundle**

In `scripts/bundle.mjs` add a second `build` call:

```js
await build({
  entryPoints: ["webview/main.tsx"],
  outfile: "media/workbench.js",
  bundle: true,
  platform: "browser",
  format: "iife",
  target: "es2022",
  jsx: "automatic",
  define: { "process.env.NODE_ENV": '"production"' },
  sourcemap: false,
  logLevel: "info",
});
```

In `package.json` change `build` to `tsc --noEmit -p tsconfig.json && tsc --noEmit -p webview/tsconfig.json && node scripts/bundle.mjs`. In `.vscodeignore` add `!media/workbench.js`. Add `media/workbench.js` to the repo `.gitignore` if `media/*.js` is not already ignored (check `git check-ignore extensions/vscode/media/workbench.js`).

- [ ] **Step 3: Panel adapter**

`src/host/workbenchPanel.ts` (the only new file importing `vscode`):

```ts
import * as vscode from "vscode";
import { parseUiMessage, type HostMessage } from "@agorix/studio-protocol";
import { WORKBENCH_CSS } from "@agorix/studio-ui";
import { createWorkbenchHost, type HostPort, type WorkbenchHost } from "./workbenchHost.js";

const VIEW_TYPE = "agorixStudio.workbench";
let panel: vscode.WebviewPanel | undefined;
let host: WorkbenchHost | undefined;
let blockCounter = 0;

function nonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function workbenchHtml(token: string, cspSource: string, scriptUri: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${token}'; script-src 'nonce-${token}' ${cspSource};" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Agorix Workbench</title><style nonce="${token}">${WORKBENCH_CSS}</style></head>
<body><div id="root"></div><script nonce="${token}" src="${scriptUri}"></script></body></html>`;
}

async function send(messages: readonly HostMessage[]): Promise<void> {
  for (const message of messages) {
    await panel?.webview.postMessage(message);
  }
}

export function openWorkbenchPanel(context: vscode.ExtensionContext, port: HostPort): void {
  if (panel !== undefined) {
    panel.reveal(vscode.ViewColumn.Beside, true);
    return;
  }
  const mediaRoot = vscode.Uri.file(context.asAbsolutePath("media"));
  panel = vscode.window.createWebviewPanel(
    VIEW_TYPE,
    "Agorix Workbench",
    vscode.ViewColumn.Beside,
    {
      enableScripts: true,
      localResourceRoots: [mediaRoot],
      retainContextWhenHidden: true,
    },
  );
  host = createWorkbenchHost(port, () => `block:wb_${(blockCounter += 1)}`);
  const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaRoot, "workbench.js"));
  panel.webview.html = workbenchHtml(nonce(), panel.webview.cspSource, scriptUri.toString());
  panel.webview.onDidReceiveMessage((raw: unknown) => {
    const message = parseUiMessage(raw);
    if (message === undefined || host === undefined) {
      return;
    }
    void host.handle(message).then(send, () => undefined);
  });
  panel.onDidDispose(() => {
    panel = undefined;
    host = undefined;
  });
}

export function refreshWorkbench(): void {
  if (host !== undefined) {
    void send(host.snapshot());
  }
}

export function disposeWorkbench(): void {
  panel = undefined;
  host = undefined;
}
```

If the `crypto` global is unavailable in the Node 20 extension host types, import `randomBytes` from `node:crypto` instead.

- [ ] **Step 4: Wire into `extension.ts`**

Add imports for `openWorkbenchPanel`, `refreshWorkbench`, `disposeWorkbench` and `HostPort`. Add a module-level function:

```ts
function workbenchPort(): HostPort {
  return {
    getProgram: () => current?.project.stored.program,
    commit: async (program) => {
      const open = requireProject();
      if (open === undefined) {
        return;
      }
      const previousRaw = serializeStoredProject(open.project.stored);
      await writeCurrentProject(createStoredProjectWithProgram(open.project.stored, program));
      undoStack.push({ uri: open.uri, raw: previousRaw });
      redoStack.length = 0;
    },
    openProposalReview: async () => {
      if (activeProposal !== undefined) {
        await reviewProposalSession(activeProposal);
      }
    },
    reveal: (nodeId) => revealCanonicalNode(nodeId),
  };
}
```

In `afterCanonicalProgramChange()` append `refreshWorkbench();`. In `resetProjectSessionState()` append `refreshWorkbench();`. In `deactivate()` call `disposeWorkbench()`. In `activate`, register next to the other commands: `vscode.commands.registerCommand("agorixStudio.openWorkbench", guarded(output, "Open Workbench", async () => { if (requireProject() === undefined) { return; } openWorkbenchPanel(context, workbenchPort()); refreshWorkbench(); }))`. Do not remove any existing command or view.

In `package.json` add the command (`"command": "agorixStudio.openWorkbench", "title": "Open Workbench", "category": "Agorix Studio"`) and activation event `onCommand:agorixStudio.openWorkbench`. Add it to the Projects view title menu next to `openWorldPreview` if that entry exists (check the `menus` block and mirror it).

- [ ] **Step 5: Tests**

- In `extension.test.ts`, extend the `vscode` mock only as needed (`createWebviewPanel` already exists; add `asWebviewUri`, `webview.onDidReceiveMessage`, `joinPath`/`Uri.file` stubs if missing) and add: `agorixStudio.openWorkbench` is registered; invoking it before a project is open shows the existing "open a project" guidance and creates no panel; after `createProject`/`openProject` it creates exactly one panel, and invoking it twice reveals instead of creating a second (Review Focus).
- Unit test `workbenchHtml` in `src/host/workbenchPanel.test.ts` (mock `vscode` minimally or move `workbenchHtml` to `workbenchHost.ts`-adjacent pure file `workbenchHtml.ts` to avoid mocking; prefer the pure file): assert the CSP string contains `default-src 'none'`, no `http:` or `https:` substring, no ` style="` and no `onclick=`, and that the script tag carries the nonce.
- Dispatch test: feeding a malformed message (`{}`, `"x"`, oversize id) to the panel's receive handler does not throw and does not call `commit`.
- Undo test: after a Workbench `insertBlock`, `agorixStudio.undoProposal` restores the previous file contents (read the written raw from the mock fs) and a subsequent Workbench edit clears redo.

- [ ] **Step 6: Verify and commit**

Run: `pnpm prettier --write extensions/vscode && pnpm --filter agorix-studio build && pnpm --filter agorix-studio test && pnpm lint`
Expected: PASS; `extensions/vscode/media/workbench.js` exists after build.

Run: `pnpm --filter agorix-studio package` then `pnpm --filter agorix-studio test:vsix`
Expected: PASS (if `test:vsix` needs a display or network unavailable locally, record that and rely on CI's `vscode-extension-smoke`; do not skip silently).

```bash
git add extensions/vscode
git commit -m "feat(studio): Workbench webview panel wired to canonical write path

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Docs and release gate evidence

**Files:**

- Modify: `docs/product/AGORIX_STUDIO.md`, `docs/product/STUDIO_RELEASE_GATE.md`

**Interfaces:**

- Consumes: Tasks 1-5.
- Produces: documentation of the new surface.

- [ ] **Step 1: Update docs**

In `AGORIX_STUDIO.md` surface table add a row `Workbench | Canvas projection of the canonical program with an icon-first palette, drag and drop and keyboard equivalents; opens beside the code editor.` In `STUDIO_RELEASE_GATE.md` add `agorixStudio.openWorkbench` to the command surface list and add a parity row "Block editing (Workbench)" with shared contract `BlockWorkspaceSnapshot`, `interaction-core` intents and `studio-protocol`, evidence `extensions/vscode/src/host/workbenchHost.test.ts` and `packages/studio-ui/src/components.test.tsx`, and intentional difference "Studio canvas is IDE-native, not the Web Scratch-like editor (ADR 0007)". Reuse the existing table column order.

- [ ] **Step 2: Full verification and PR**

Run: `pnpm prettier --write docs && pnpm lint && pnpm format:check && pnpm test && pnpm build && pnpm security:check`
Expected: PASS. Also run `grep -rnE "from \"vscode\"" packages` and expect no matches.

```bash
git add docs
git commit -m "docs(studio): document the Workbench surface and gate evidence

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
git push -u origin docs/studio-workbench-plan
gh pr create --base main --title "Studio Workbench: canvas, palette and drag and drop on the shared core" --body "Implements Plan B (docs/superpowers/plans/2026-10-04-studio-workbench.md).

🤖 Generated with [Claude Code](https://claude.com/claude-code)"
```

Do not self-merge.

---

## Self-review

- **Spec coverage:** D1 (webview in VS Code) -> Task 5; D2/D3 Studio canvas, palette, DnD, keyboard parity -> Tasks 2-3; intents through the host only -> Task 4; protocol -> Task 1; D5 anchors: `askAgent` and agent drop zones exist but answer `agentUnavailable` (the agent layer is Plan D). Not covered here by design: modularizing `extension.ts` (Plan B2), Mission Spec and agent panel, density levels, custom editor, Web (Plan C), cross-surface hash gate.
- **Placeholders:** none; Task 3 specifies behaviors precisely because JSX is mechanical, and each behavior has a named test.
- **Type consistency:** `HostPort`, `WorkbenchHost`, `RenderRow`, `HostBridge`, `workspace`/`error` messages are defined once and consumed with the same names.
- **Review Focus** is pinned: invalid change (Task 4 tests), undo/redo (Task 5), malformed message (Task 5), stale project (`refreshWorkbench` in `resetProjectSessionState`, Task 5), CSP (Task 5 pure test), adjacent-slot drops (Task 2 slot-adjacency test and Task 4 move tests), single panel (Task 5).
- **Known risks:** inserted block ids (`block:wb_N`) must be accepted by `workspaceToProgram`; if validation rejects them, use the id format of `createStarterWorkspace` and ledger a ruling. `programSemanticHash` length must satisfy the 128-char hash pattern; verify in Task 4.
