import { describe, expect, it, vi } from "vitest";
import { createSyncHub } from "./syncHub.js";

describe("SyncHub", () => {
  it("select notifies every time, even for the same node", () => {
    const hub = createSyncHub();
    const listener = vi.fn();
    hub.subscribe(listener);
    hub.select("scripts[0]/statements[0]", "inspector");
    hub.select("scripts[0]/statements[0]", "inspector");
    expect(listener).toHaveBeenCalledTimes(2);
    expect(hub.getState().selectedNodeId).toBe("scripts[0]/statements[0]");
  });

  it("does not echo to a listener that ignores the source", () => {
    const hub = createSyncHub();
    const code = vi.fn();
    const preview = vi.fn();
    hub.subscribe(code, { ignoreSource: "code" });
    hub.subscribe(preview);
    hub.select("n1", "code");
    expect(code).not.toHaveBeenCalled();
    expect(preview).toHaveBeenCalledWith({ selectedNodeId: "n1" }, "code");
  });

  it("executionFailed replaces executing; executionStep clears failed; reset keeps selection", () => {
    const hub = createSyncHub();
    hub.select("sel", "canvas");
    hub.executionStep("a");
    expect(hub.getState()).toEqual({ selectedNodeId: "sel", executingNodeId: "a" });
    hub.executionFailed("b");
    expect(hub.getState()).toEqual({ selectedNodeId: "sel", failedNodeId: "b" });
    hub.executionStep("c");
    expect(hub.getState()).toEqual({ selectedNodeId: "sel", executingNodeId: "c" });
    hub.executionReset();
    expect(hub.getState()).toEqual({ selectedNodeId: "sel" });
  });

  it("reconcile drops unknown ids and notifies only on change", () => {
    const hub = createSyncHub();
    hub.select("gone", "canvas");
    hub.executionFailed("kept");
    const listener = vi.fn();
    hub.subscribe(listener);
    hub.reconcile(["kept"]);
    expect(hub.getState()).toEqual({ failedNodeId: "kept" });
    expect(listener).toHaveBeenCalledTimes(1);
    hub.reconcile(["kept"]);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("unsubscribe stops notifications", () => {
    const hub = createSyncHub();
    const listener = vi.fn();
    const dispose = hub.subscribe(listener);
    dispose();
    hub.select("n", "canvas");
    expect(listener).not.toHaveBeenCalled();
  });
});
