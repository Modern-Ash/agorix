// @vitest-environment node
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import { handleStageMessage } from "../host/stageMessages.js";
import type { StudioExecutionViewState } from "../studioCore.js";
import { createNonce } from "./framework.js";
import { renderWorldPreview, worldPreviewInboundSchemas } from "./worldPreview.js";
import { validateMessage } from "./framework.js";

function frame(step: number, x: number, node?: string) {
  return {
    step,
    kind: "statement-end",
    running: true,
    reachedGoal: false,
    highlightedNodeId: node,
    state: {
      sprite: { x, y: 0, heading: 0, radius: 10 },
      goal: { x: 30, y: 0, radius: 10 },
      viewport: { width: 100, height: 100 },
    },
  };
}

function viewAt(selected: number, status = "running"): StudioExecutionViewState {
  const frames = [
    frame(0, 0),
    frame(1, 10, "scripts[0]/statements[0]"),
    frame(2, 20, "scripts[0]/statements[1]"),
  ];
  return {
    status,
    selectedFrameIndex: selected,
    currentFrame: frames[selected],
    outcome: "completed",
    stepsUsed: 2,
    previewFrames: frames,
    inspectorSteps: [0, 1, 2].map((index) => ({
      index,
      frameIndex: index,
      runtimeStep: index,
      nodeId: index === 0 ? undefined : `scripts[0]/statements[${index - 1}]`,
      statementType: index === 0 ? undefined : "move",
      timing: "after-statement",
      summary: `moved right to x ${index * 10}`,
      provenance: "runtime fact",
    })),
  } as unknown as StudioExecutionViewState;
}

function mount(view: StudioExecutionViewState) {
  const posted: Array<Record<string, unknown>> = [];
  const html = renderWorldPreview(view, createNonce(), "vscode-webview:");
  const dom = new JSDOM(html, {
    runScripts: "dangerously",
    beforeParse(window) {
      (window as unknown as { acquireVsCodeApi: () => unknown }).acquireVsCodeApi = () => ({
        postMessage: (message: Record<string, unknown>) => posted.push(message),
        getState: () => undefined,
        setState: () => undefined,
      });
    },
  });
  const { document, window } = dom.window;
  const send = (data: unknown) =>
    window.dispatchEvent(new window.MessageEvent("message", { data }));
  return { document, window, posted, send };
}

describe("Stage panel (webview end to end)", () => {
  it("announces ready, shows the readout and one trace row per step", () => {
    const { document, posted } = mount(viewAt(1));
    expect(posted).toContainEqual({ type: "agorix-ready" });
    expect(document.getElementById("readout")?.textContent).toContain("x 10");
    expect(document.querySelectorAll("#rows tr")).toHaveLength(3);
    expect(document.querySelector('#rows tr[aria-current="step"]')?.textContent).toContain("1");
    expect(document.getElementById("status")?.textContent).toBe("RUNNING");
  });

  it("run, step, stop and reset buttons post allowlisted commands", () => {
    const { document, posted } = mount(viewAt(0, "idle"));
    for (const name of ["run", "step", "stop", "reset"]) {
      (document.querySelector(`[data-command="${name}"]`) as HTMLButtonElement).click();
    }
    expect(posted.filter((m) => m["type"] === "agorix-command").map((m) => m["command"])).toEqual([
      "run",
      "step",
      "stop",
      "reset",
    ]);
  });

  it("keyboard shortcuts R, S, X and 0 drive the same commands, but not while typing", () => {
    const { document, window, posted } = mount(viewAt(0, "idle"));
    for (const key of ["r", "s", "x", "0"]) {
      document.dispatchEvent(new window.KeyboardEvent("keydown", { key, bubbles: true }));
    }
    document
      .getElementById("scrub")!
      .dispatchEvent(new window.KeyboardEvent("keydown", { key: "r", bubbles: true }));
    expect(posted.filter((m) => m["type"] === "agorix-command").map((m) => m["command"])).toEqual([
      "run",
      "step",
      "stop",
      "reset",
    ]);
  });

  it("scrubbing and clicking a trace row select that step", () => {
    const { document, window, posted } = mount(viewAt(0, "idle"));
    const scrub = document.getElementById("scrub") as HTMLInputElement;
    expect(scrub.max).toBe("2");
    scrub.value = "2";
    scrub.dispatchEvent(new window.Event("change", { bubbles: true }));
    (document.querySelectorAll("#rows tr")[1] as HTMLElement).click();
    expect(posted.filter((m) => m["type"] === "agorix-select-step")).toEqual([
      { type: "agorix-select-step", index: 2 },
      { type: "agorix-select-step", index: 1 },
    ]);
  });

  it("a new frame from the host updates readout, current row and scrubber", () => {
    const { document, send } = mount(viewAt(0, "idle"));
    send({ type: "agorix-frame", view: viewAt(2, "completed") });
    expect(document.getElementById("readout")?.textContent).toContain("x 20");
    expect(document.getElementById("status")?.textContent).toBe("COMPLETED");
    expect((document.getElementById("scrub") as HTMLInputElement).value).toBe("2");
    expect(document.querySelector('#rows tr[aria-current="step"]')?.textContent).toContain("2");
  });

  it("revealing a node from the trace posts it for the editor to select", () => {
    const { document, posted } = mount(viewAt(2));
    (document.querySelector("#rows button.node") as HTMLButtonElement).click();
    expect(posted).toContainEqual({
      type: "agorix-reveal-node",
      nodeId: "scripts[0]/statements[0]",
    });
  });
});

describe("Stage host messages", () => {
  const calls: unknown[][] = [];
  const deps = {
    selectNode: (id: string) => calls.push(["select", id]),
    execute: (id: string, ...args: unknown[]) => calls.push(["execute", id, ...args]),
    ready: () => calls.push(["ready"]),
  };

  it("maps commands and step selection to Studio commands", async () => {
    calls.length = 0;
    await handleStageMessage({ type: "agorix-command", command: "run" }, deps);
    await handleStageMessage({ type: "agorix-select-step", index: 3 }, deps);
    await handleStageMessage({ type: "agorix-reveal-node", nodeId: "scripts[0]" }, deps);
    await handleStageMessage({ type: "agorix-ready" }, deps);
    expect(calls).toEqual([
      ["execute", "agorixStudio.run"],
      ["execute", "agorixStudio.selectExecutionStep", 3],
      ["select", "scripts[0]"],
      ["ready"],
    ]);
  });

  it("rejects commands and indexes outside the allowlist", () => {
    for (const bad of [
      { type: "agorix-command", command: "deleteEverything" },
      { type: "agorix-command", command: "run; rm" },
      { type: "agorix-select-step", index: -1 },
      { type: "agorix-select-step", index: 1.5 },
      { type: "agorix-select-step", index: "2" },
    ]) {
      expect(validateMessage(worldPreviewInboundSchemas, bad).ok).toBe(false);
    }
    expect(
      validateMessage(worldPreviewInboundSchemas, { type: "agorix-command", command: "step" }).ok,
    ).toBe(true);
  });
});
