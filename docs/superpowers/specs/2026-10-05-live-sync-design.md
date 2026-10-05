# Live sync: canvas, code, World Preview and Inspector (design)

Sub-project 1 of the Studio "powerization" remainder. Date: 2026-10-05.

## Goal

One shared sync state in the extension host. Selecting a node on any surface (canvas, code editor, World Preview, Inspector) highlights the same node on the others. During a run the executing node is marked, and on failure the failed node.

## Success criteria

- Selection on one surface highlights the same node on the other three.
- Executing and failed nodes are visible on canvas and code. Failure is not conveyed by color alone (icon plus label).
- Unit tests cover the hub, the protocol message and the host/preview wiring. Extension Host smoke test is out of scope (sub-project 5).

## Design

### 1. SyncHub (`extensions/vscode/src/sync/syncHub.ts`)

Pure module, no `vscode` import.

- State: `{ selectedNodeId?, executingNodeId?, failedNodeId?, source? }`. All ids canonical (`getCanonicalNodeIdForBlock`).
- Intents: `select(nodeId, source)`, `clearSelection()`, `executionStep(nodeId)`, `executionFailed(nodeId)`, `executionReset()`, `reconcile(validNodeIds)`.
- `subscribe(listener)` returns a dispose function. A listener never receives the echo of its own `source`.

### 2. Protocol (`packages/studio-protocol`)

- New `HostMessage` `sync` with `{ selectedNodeId?, executingNodeId?, failedNodeId? }`, validated in the host-message parser.
- No new `UiMessage`: canvas `revealNode` / `highlightNodes` are translated by `workbenchHost` into `hub.select`.
- World Preview gains an `agorix-sync` host message beside the existing `agorix-frame`; `agorix-reveal-node` stays.

### 3. Producers

- Canvas: `workbenchHost` intents → `select(…, "canvas")`.
- Code editor: `onDidChangeTextEditorSelection` → position-to-node via the projection mapping used by `commands/projections.ts` → `select(…, "code")`, debounced.
- World Preview / Inspector: node or row click → `select(…, "preview" | "inspector")`.
- Execution: frame/step advance → `executionStep`; error or `budget-exceeded` → `executionFailed`. The failed-node computation at `studioRuntime.ts:107` moves into the hub.

### 4. Consumers

- Canvas: distinct styles for selected, executing, failed.
- Code: editor decoration on the node range; `revealRange` only when `source !== "code"`.
- World Preview and Inspector: highlight node; Inspector scrolls the row into view.
- `refreshWorkbench` / `refreshWorldPreview` subscribe to the hub instead of being called per command.

### 5. Errors and edges

- Node removed by a commit: `reconcile` clears it from the hub against the new program.
- Invalid program: hub is cleared, no throw.
- No code editor open: decoration is skipped.

### 6. Tests

- `syncHub`: echo suppression, reconcile on program change, intent ordering.
- Protocol: valid and invalid `sync` parse.
- `workbenchHost`: `revealNode` updates the hub.
- `worldPreview`: script handles `agorix-sync`.

## Out of scope

Extension Host test, per-node proposal actions, provider-backed proposals, evidence export.
