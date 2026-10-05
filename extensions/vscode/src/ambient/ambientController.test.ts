import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createLayaLearningProvider,
  createStudioPipeline,
  createStudioSignal,
  type ProactiveOfferAction,
  type StudioPipeline,
} from "@agorix/learning-decision-plane";
import { AmbientController } from "./ambientController.js";

let quickPick: unknown;
let shownPicks: Array<{ action: string }> = [];

vi.mock("vscode", () => ({
  window: {
    showQuickPick: async (picks: Array<{ action: string }>) => {
      shownPicks = picks;
      return quickPick;
    },
  },
}));

function statusItem() {
  return {
    text: "",
    tooltip: "",
    command: undefined as unknown,
    show: vi.fn(),
    dispose: vi.fn(),
  };
}

function controller(
  options: {
    readonly budget?: number;
    readonly proactivePipeline?: StudioPipeline;
    readonly canOffer?: boolean;
    readonly allowAction?: (action: ProactiveOfferAction) => boolean;
  } = {},
) {
  const item = statusItem();
  const run = vi.fn(async () => undefined);
  const showCanvasHint = vi.fn();
  const clearCanvasHint = vi.fn();
  let offers = 0;
  const stats = { shown: 0, accepted: 0, dismissed: 0, ignored: 0 };
  const c = new AmbientController({
    statusBarItem: item as never,
    programId: () => "p1",
    executionStatus: () => "idle",
    aiEnabled: () => true,
    canOfferSignal: () => options.canOffer ?? true,
    ...(options.allowAction === undefined ? {} : { allowAction: options.allowAction }),
    budgetRemaining: () =>
      options.budget === undefined ? undefined : Math.max(0, options.budget - offers),
    recordOffer: (outcome) => {
      stats[outcome] += 1;
      if (outcome === "shown") {
        offers += 1;
      }
    },
    runCompanionAction: run,
    showCanvasHint,
    clearCanvasHint,
    ...(options.proactivePipeline === undefined
      ? {}
      : { proactivePipeline: () => options.proactivePipeline }),
  });
  return { c, item, run, offers: () => offers, stats, showCanvasHint, clearCanvasHint };
}

describe("AmbientController", () => {
  beforeEach(() => {
    quickPick = undefined;
  });

  it("offers, accepts and runs the picked action without provider work beforehand", async () => {
    const { c, item, run, offers, stats, showCanvasHint, clearCanvasHint } = controller();

    const signal = createStudioSignal("runtime-error", 1, { code: "E_LOOP" })!;
    await c.handleSignal(signal);
    expect(item.text).toContain("Companion");
    expect(item.command).toBe("agorixStudio.ambientOffer");
    expect(run).not.toHaveBeenCalled();
    expect(offers()).toBe(1);
    expect(showCanvasHint).toHaveBeenCalledWith(
      signal,
      expect.objectContaining({ action: "offer" }),
    );

    quickPick = { label: "$(debug-alt) Debug", action: "debug" };
    await c.showOffer();
    expect(run).toHaveBeenCalledWith("debug");
    expect(clearCanvasHint).toHaveBeenCalled();
    expect(item.text).toBe("$(sparkle)");
    expect(stats).toEqual({ shown: 1, accepted: 1, dismissed: 0, ignored: 0 });
  });

  it("records decline and suppresses the same program during cooldown", async () => {
    const { c, item, stats } = controller();
    await c.handleSignal(createStudioSignal("runtime-error", 10, { code: "E_LOOP" })!);
    quickPick = { label: "Not now", action: "decline" };
    await c.showOffer();

    await c.handleSignal(createStudioSignal("runtime-error", 11, { code: "E_LOOP" })!);
    expect(item.command).toBeUndefined();
    expect(item.text).toBe("$(sparkle)");
    expect(stats).toEqual({ shown: 1, accepted: 0, dismissed: 1, ignored: 0 });
  });

  it("counts an old offer as ignored when a newer signal arrives", async () => {
    const { c, item, stats } = controller();
    await c.handleSignal(createStudioSignal("runtime-error", 1, { code: "E_LOOP" })!);
    await c.handleSignal(createStudioSignal("runtime-error", 2, { code: "E_LOOP" })!);

    expect(item.command).toBeUndefined();
    expect(item.text).toBe("$(sparkle)");
    expect(stats).toEqual({ shown: 1, accepted: 0, dismissed: 0, ignored: 1 });
  });

  it("uses LAYA as an optional high-confidence veto", async () => {
    const proactivePipeline = createStudioPipeline({
      system1: createLayaLearningProvider({
        decideMany: async () => [
          { id: "generativeNeeded", value: "no", confidence: 0.99 },
          { id: "reasoningTier", value: "deterministic", confidence: 0.99 },
        ],
      }),
      route: () => ({
        status: "deterministic",
        reason: "ambient-pre-acceptance",
        providerRequestAllowed: false,
      }),
    });
    const { c, item } = controller({
      proactivePipeline,
    });

    await c.handleSignal(createStudioSignal("runtime-error", 1, { code: "E_LOOP" })!);
    expect(item.command).toBeUndefined();
    expect(item.text).toBe("$(sparkle)");
  });

  it("shows the ambient budget cap without offering", async () => {
    const { c, item, offers } = controller({ budget: 0 });

    await c.handleSignal(createStudioSignal("runtime-error", 1, { code: "E_LOOP" })!);
    expect(item.text).toContain("$(warning)");
    expect(item.command).toBeUndefined();
    expect(offers()).toBe(0);
  });
});

describe("AmbientController assistance ceiling", () => {
  beforeEach(() => {
    quickPick = undefined;
    shownPicks = [];
  });

  it("offers only the actions the ceiling allows", async () => {
    const { c } = controller({ allowAction: (action) => action === "debug" });
    await c.handleSignal(createStudioSignal("runtime-error", 1, { code: "E_LOOP" })!);
    await c.showOffer();
    expect(shownPicks.map((pick) => pick.action)).toEqual(["debug", "decline"]);
  });

  it("stays quiet, and counts no offer, when nothing is allowed", async () => {
    const { c, item, stats, showCanvasHint } = controller({ allowAction: () => false });
    await c.handleSignal(createStudioSignal("runtime-error", 1, { code: "E_LOOP" })!);
    expect(item.command).toBeUndefined();
    expect(item.text).toBe("$(sparkle)");
    expect(stats.shown).toBe(0);
    expect(showCanvasHint).not.toHaveBeenCalled();
  });
});
