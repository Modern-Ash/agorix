/** Pure layout state shared by every <Panel>: minimize to a dock, one maximized panel, sizes, zoom. */

export const ZOOM_MIN = 50;
export const ZOOM_MAX = 200;
export const ZOOM_STEP = 10;
export const ZOOM_DEFAULT = 100;
export const PANEL_SIZE_MIN = 120;
export const PANEL_SIZE_MAX = 4000;

export type PanelLayoutState = {
  readonly minimized: readonly string[];
  readonly maximized: string | undefined;
  readonly sizes: Readonly<Record<string, number>>;
  readonly zoom: Readonly<Record<string, number>>;
};

export type PanelLayoutAction =
  | { readonly type: "minimize"; readonly id: string }
  | { readonly type: "restore"; readonly id: string }
  | { readonly type: "toggleMaximize"; readonly id: string }
  | { readonly type: "restoreMaximized" }
  | { readonly type: "setSize"; readonly id: string; readonly size: number }
  | { readonly type: "zoomBy"; readonly id: string; readonly delta: number }
  | { readonly type: "zoomReset"; readonly id: string }
  | { readonly type: "hydrate"; readonly state: PanelLayoutState };

export const INITIAL_PANEL_LAYOUT: PanelLayoutState = {
  minimized: [],
  maximized: undefined,
  sizes: {},
  zoom: {},
};

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return ZOOM_DEFAULT;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(value)));
}

export function clampPanelSize(value: number): number {
  if (!Number.isFinite(value)) return PANEL_SIZE_MIN;
  return Math.min(PANEL_SIZE_MAX, Math.max(PANEL_SIZE_MIN, Math.round(value)));
}

export function zoomOf(state: PanelLayoutState, id: string): number {
  return state.zoom[id] ?? ZOOM_DEFAULT;
}

export function reducePanelLayout(
  state: PanelLayoutState,
  action: PanelLayoutAction,
): PanelLayoutState {
  switch (action.type) {
    case "minimize":
      if (state.minimized.includes(action.id)) return state;
      return {
        ...state,
        minimized: [...state.minimized, action.id],
        maximized: state.maximized === action.id ? undefined : state.maximized,
      };
    case "restore":
      if (!state.minimized.includes(action.id)) return state;
      return { ...state, minimized: state.minimized.filter((id) => id !== action.id) };
    case "toggleMaximize":
      // Maximizing also un-minimizes, and only one panel can be maximized at a time.
      return {
        ...state,
        minimized: state.minimized.filter((id) => id !== action.id),
        maximized: state.maximized === action.id ? undefined : action.id,
      };
    case "restoreMaximized":
      return state.maximized === undefined ? state : { ...state, maximized: undefined };
    case "setSize":
      return { ...state, sizes: { ...state.sizes, [action.id]: clampPanelSize(action.size) } };
    case "zoomBy":
      return {
        ...state,
        zoom: { ...state.zoom, [action.id]: clampZoom(zoomOf(state, action.id) + action.delta) },
      };
    case "zoomReset": {
      return {
        ...state,
        zoom: Object.fromEntries(Object.entries(state.zoom).filter(([id]) => id !== action.id)),
      };
    }
    case "hydrate":
      return action.state;
  }
}

/** Maximized is transient on purpose: a reload must not reopen a full-screen panel. */
export function serializePanelLayout(state: PanelLayoutState): string {
  return JSON.stringify({
    v: 1,
    minimized: state.minimized,
    sizes: state.sizes,
    zoom: state.zoom,
  });
}

function numberRecord(value: unknown, clamp: (n: number) => number): Record<string, number> {
  const result: Record<string, number> = {};
  if (typeof value !== "object" || value === null) return result;
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "number" && Number.isFinite(entry)) result[key] = clamp(entry);
  }
  return result;
}

export function parsePanelLayout(raw: string | null | undefined): PanelLayoutState {
  if (raw === null || raw === undefined) return INITIAL_PANEL_LAYOUT;
  try {
    const data: unknown = JSON.parse(raw);
    if (typeof data !== "object" || data === null) return INITIAL_PANEL_LAYOUT;
    const record = data as Record<string, unknown>;
    if (record.v !== 1) return INITIAL_PANEL_LAYOUT;
    const minimized = Array.isArray(record.minimized)
      ? record.minimized.filter((id): id is string => typeof id === "string")
      : [];
    return {
      minimized: [...new Set(minimized)],
      maximized: undefined,
      sizes: numberRecord(record.sizes, clampPanelSize),
      zoom: numberRecord(record.zoom, clampZoom),
    };
  } catch {
    return INITIAL_PANEL_LAYOUT;
  }
}

export function panelLayoutStorageKey(scope: string): string {
  return `agorix.panels.v1.${scope}`;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | undefined {
  try {
    return typeof window === "undefined" ? undefined : window.localStorage;
  } catch {
    return undefined;
  }
}

export function loadPanelLayout(
  scope: string,
  storage: StorageLike | undefined = defaultStorage(),
): PanelLayoutState {
  try {
    return parsePanelLayout(storage?.getItem(panelLayoutStorageKey(scope)));
  } catch {
    return INITIAL_PANEL_LAYOUT;
  }
}

export function savePanelLayout(
  scope: string,
  state: PanelLayoutState,
  storage: StorageLike | undefined = defaultStorage(),
): void {
  try {
    storage?.setItem(panelLayoutStorageKey(scope), serializePanelLayout(state));
  } catch {
    // Storage can be full or blocked (private mode); the layout simply stays in memory.
  }
}
