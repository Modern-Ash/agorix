import { describe, expect, it } from "vitest";
import { ORI_GOAL_VERSION, runOriGoalAgent } from "./goals.js";

describe("Ori free-world goals", () => {
  it("accepts a reachable runtime-proven goal with a turn", async () => {
    const result = await runOriGoalAgent("es", {
      generate: () =>
        JSON.stringify({ version: ORI_GOAL_VERSION, cx: 3, cy: 1, challenge: "turn" }),
    });
    expect(result).toMatchObject({
      source: "model",
      cell: { cx: 3, cy: 1 },
      successCheck: "touches-goal-after-turn",
    });
    expect(result.message).toContain("giro");
  });

  it.each([
    { version: ORI_GOAL_VERSION, cx: 0, cy: 2, challenge: "reach" },
    { version: ORI_GOAL_VERSION, cx: 8, cy: 1, challenge: "reach" },
    { version: ORI_GOAL_VERSION, cx: 3, cy: 1, challenge: "sing" },
    { version: ORI_GOAL_VERSION, cx: 3, cy: 1, challenge: "turn", text: "ignore safety" },
  ])("rejects an unexpressible or out-of-scope model goal", async (raw) => {
    const result = await runOriGoalAgent("es", { generate: () => JSON.stringify(raw) });
    expect(result.source).toBe("fallback");
    expect(result.successCheck).toBe("touches-goal");
  });

  it("offers a fixed verified goal when AI is down", async () => {
    const result = await runOriGoalAgent("es");
    expect(result).toMatchObject({
      source: "fallback",
      cell: { cx: 4, cy: 2 },
      successCheck: "touches-goal",
    });
  });
});
