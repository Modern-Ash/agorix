import { beforeEach, describe, expect, it, vi } from "vitest";
import { createStudioSignal, type LayaBatchTransport } from "@agorix/learning-decision-plane";
import { AmbientController } from "./ambientController.js";

let quickPick: unknown;

vi.mock("vscode", () => ({
  window: {
    showQuickPick: async () => quickPick,
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
    readonly layaTransport?: LayaBatchTransport;
    readonly canOffer?: boolean;
  } = {},
) {
  const item = statusItem();
  const run = vi.fn(async () => undefined);
  let offers = 0;
  const stats = { shown: 0, accepted: 0, dismissed: 0, ignored: 0 };
  const c = new AmbientController({
    statusBarItem: item as never,
    programId: () => "p1",
    executionStatus: () => "idle",
    aiEnabled: () => true,
    canOfferSignal: () => options.canOffer ?? true,
    budgetRemaining: () =>
      options.budget === undefined ? undefined : Math.max(0, options.budget - offers),
    recordOffer: (outcome) => {
      stats[outcome] += 1;
      if (outcome === "shown") {
        offers += 1;
      }
    },
    runCompanionAction: run,
    ...(options.layaTransport === undefined ? {} : { layaTransport: options.layaTransport }),
  });
  return { c, item, run, offers: () => offers, stats };
}

describe("AmbientController", () => {
  beforeEach(() => {
    quickPick = undefined;
  });

  it("offers, accepts and runs the picked action without provider work beforehand", async () => {
    const { c, item, run, offers, stats } = controller();

    await c.handleSignal(createStudioSignal("runtime-error", 1, { code: "E_LOOP" })!);
    expect(item.text).toContain("Companion");
    expect(item.command).toBe("agorixStudio.ambientOffer");
    expect(run).not.toHaveBeenCalled();
    expect(offers()).toBe(1);

    quickPick = { label: "$(debug-alt) Debug", action: "debug" };
    await c.showOffer();
    expect(run).toHaveBeenCalledWith("debug");
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
    const { c, item } = controller({
      layaTransport: {
        decideMany: async () => [{ id: "proactiveAction", value: "silence", confidence: 0.99 }],
      },
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
