import { describe, expect, it } from "vitest";
import { defaultKidsCatalog, type KidsCatalog } from "@agorix/curriculum";
import { defaultAiConfig } from "./aiConfig.js";
import { gateAiConfig } from "./aiConfigGate.js";

const config = defaultAiConfig(
  {
    provider: "auto",
    codexBin: "codex",
    codexModel: "gpt-6-luna",
    opencodeBin: "opencode",
    timeoutMs: 7_000,
  },
  { adapter: "fake", timeoutMs: 4_000, capabilities: ["coach"] },
);

describe("publish gate and missions (issue #616)", () => {
  it("passes with the built-in missions", async () => {
    expect(await gateAiConfig(config)).toEqual([]);
  });

  it("refuses a catalog with a mission the runtime cannot win, and says only which check failed", async () => {
    const broken = structuredClone(defaultKidsCatalog()) as unknown as {
      [world: string]: { goal: { cx: number; cy: number } }[];
    };
    broken.city![0]!.goal = { cx: 9, cy: 1 };
    const failures = await gateAiConfig({ ...config, catalog: broken as unknown as KidsCatalog });
    expect(failures).toEqual(["mission-unsolvable"]);
  });
});
