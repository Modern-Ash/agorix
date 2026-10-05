export type SyncSource = "canvas" | "code" | "preview" | "inspector" | "runtime";

export interface SyncState {
  readonly selectedNodeId?: string;
  readonly executingNodeId?: string;
  readonly failedNodeId?: string;
}

export type SyncListener = (state: SyncState, source: SyncSource) => void;

export interface SyncHub {
  getState(): SyncState;
  select(nodeId: string, source: SyncSource): void;
  clearSelection(source: SyncSource): void;
  executionStep(nodeId: string): void;
  executionFailed(nodeId: string): void;
  executionReset(): void;
  reconcile(validNodeIds: readonly string[]): void;
  subscribe(listener: SyncListener, options?: { readonly ignoreSource?: SyncSource }): () => void;
}

type MutableState = { -readonly [K in keyof SyncState]: SyncState[K] };

function without(state: SyncState, keys: readonly (keyof SyncState)[]): SyncState {
  const copy: MutableState = { ...state };
  for (const key of keys) delete copy[key];
  return copy;
}

export function createSyncHub(): SyncHub {
  let state: SyncState = {};
  const listeners = new Set<{ fn: SyncListener; ignore: SyncSource | undefined }>();

  function set(next: SyncState, source: SyncSource): void {
    state = next;
    for (const { fn, ignore } of [...listeners]) {
      if (ignore !== source) fn(state, source);
    }
  }

  return {
    getState: () => state,
    select: (nodeId, source) => set({ ...state, selectedNodeId: nodeId }, source),
    clearSelection: (source) => set(without(state, ["selectedNodeId"]), source),
    executionStep: (nodeId) =>
      set({ ...without(state, ["failedNodeId"]), executingNodeId: nodeId }, "runtime"),
    executionFailed: (nodeId) =>
      set({ ...without(state, ["executingNodeId"]), failedNodeId: nodeId }, "runtime"),
    executionReset: () => set(without(state, ["executingNodeId", "failedNodeId"]), "runtime"),
    reconcile: (validNodeIds) => {
      const valid = new Set(validNodeIds);
      const stale = (["selectedNodeId", "executingNodeId", "failedNodeId"] as const).filter(
        (key) => state[key] !== undefined && !valid.has(state[key] as string),
      );
      if (stale.length > 0) set(without(state, stale), "runtime");
    },
    subscribe: (fn, options) => {
      const entry = { fn, ignore: options?.ignoreSource };
      listeners.add(entry);
      return () => {
        listeners.delete(entry);
      };
    },
  };
}
