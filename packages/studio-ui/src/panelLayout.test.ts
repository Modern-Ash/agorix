import { describe, expect, it } from "vitest";
import {
  INITIAL_PANEL_LAYOUT,
  ZOOM_MAX,
  ZOOM_MIN,
  loadPanelLayout,
  parsePanelLayout,
  reducePanelLayout,
  savePanelLayout,
  serializePanelLayout,
  zoomOf,
  type PanelLayoutState,
} from "./panelLayout.js";

const run = (state: PanelLayoutState, ...actions: Parameters<typeof reducePanelLayout>[1][]) =>
  actions.reduce(reducePanelLayout, state);

describe("panel layout reducer", () => {
  it("minimizes and restores a panel without duplicates", () => {
    const once = run(INITIAL_PANEL_LAYOUT, { type: "minimize", id: "stage" });
    expect(once.minimized).toEqual(["stage"]);
    expect(reducePanelLayout(once, { type: "minimize", id: "stage" })).toBe(once);
    expect(run(once, { type: "restore", id: "stage" }).minimized).toEqual([]);
  });

  it("keeps only one maximized panel and toggles it off", () => {
    const a = run(INITIAL_PANEL_LAYOUT, { type: "toggleMaximize", id: "program" });
    expect(a.maximized).toBe("program");
    expect(run(a, { type: "toggleMaximize", id: "stage" }).maximized).toBe("stage");
    expect(run(a, { type: "toggleMaximize", id: "program" }).maximized).toBeUndefined();
  });

  it("maximizing un-minimizes and minimizing the maximized panel restores it", () => {
    const minimized = run(INITIAL_PANEL_LAYOUT, { type: "minimize", id: "code" });
    const maximized = run(minimized, { type: "toggleMaximize", id: "code" });
    expect(maximized.minimized).toEqual([]);
    expect(maximized.maximized).toBe("code");
    expect(run(maximized, { type: "minimize", id: "code" }).maximized).toBeUndefined();
  });

  it("restoreMaximized clears the maximized panel and is a no-op otherwise", () => {
    const m = run(INITIAL_PANEL_LAYOUT, { type: "toggleMaximize", id: "a" });
    expect(run(m, { type: "restoreMaximized" }).maximized).toBeUndefined();
    expect(reducePanelLayout(INITIAL_PANEL_LAYOUT, { type: "restoreMaximized" })).toBe(
      INITIAL_PANEL_LAYOUT,
    );
  });

  it("clamps zoom to 50-200 and resets to 100", () => {
    let s = INITIAL_PANEL_LAYOUT;
    for (let i = 0; i < 20; i += 1) s = run(s, { type: "zoomBy", id: "p", delta: 10 });
    expect(zoomOf(s, "p")).toBe(ZOOM_MAX);
    for (let i = 0; i < 40; i += 1) s = run(s, { type: "zoomBy", id: "p", delta: -10 });
    expect(zoomOf(s, "p")).toBe(ZOOM_MIN);
    expect(zoomOf(run(s, { type: "zoomReset", id: "p" }), "p")).toBe(100);
  });

  it("clamps sizes", () => {
    expect(run(INITIAL_PANEL_LAYOUT, { type: "setSize", id: "p", size: 5 }).sizes.p).toBe(120);
    expect(run(INITIAL_PANEL_LAYOUT, { type: "setSize", id: "p", size: 1e9 }).sizes.p).toBe(4000);
    expect(run(INITIAL_PANEL_LAYOUT, { type: "setSize", id: "p", size: NaN }).sizes.p).toBe(120);
  });

  it("resizeBy accumulates from the stored size, so rapid steps never repeat the same base", () => {
    let state = INITIAL_PANEL_LAYOUT;
    for (let i = 0; i < 3; i++)
      state = run(state, { type: "resizeBy", id: "p", delta: 16, base: 200 });
    expect(state.sizes.p).toBe(248);
    state = run(state, { type: "resizeBy", id: "p", delta: -1000, base: 200 });
    expect(state.sizes.p).toBe(120);
  });
});

describe("panel layout persistence", () => {
  const full: PanelLayoutState = {
    minimized: ["code"],
    maximized: "program",
    sizes: { stage: 440 },
    zoom: { program: 150 },
  };

  it("round-trips everything except the transient maximized panel", () => {
    expect(parsePanelLayout(serializePanelLayout(full))).toEqual({ ...full, maximized: undefined });
  });

  it("falls back to the initial state on corrupt or foreign data", () => {
    for (const raw of [null, "", "{", "[]", '{"v":2}', "42"]) {
      expect(parsePanelLayout(raw)).toEqual(INITIAL_PANEL_LAYOUT);
    }
  });

  it("drops invalid entries and clamps stored values", () => {
    const parsed = parsePanelLayout(
      JSON.stringify({ v: 1, minimized: ["a", 3, "a"], sizes: { a: "x", b: 1 }, zoom: { c: 999 } }),
    );
    expect(parsed.minimized).toEqual(["a"]);
    expect(parsed.sizes).toEqual({ b: 120 });
    expect(parsed.zoom).toEqual({ c: 200 });
  });

  it("never throws when storage is unavailable", () => {
    const broken = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("full");
      },
    };
    expect(loadPanelLayout("x", broken)).toEqual(INITIAL_PANEL_LAYOUT);
    expect(() => savePanelLayout("x", full, broken)).not.toThrow();
  });

  it("saves and loads per scope", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => void data.set(k, v),
    };
    savePanelLayout("phone", full, storage);
    expect(loadPanelLayout("phone", storage).minimized).toEqual(["code"]);
    expect(loadPanelLayout("desktop", storage)).toEqual(INITIAL_PANEL_LAYOUT);
  });
});
