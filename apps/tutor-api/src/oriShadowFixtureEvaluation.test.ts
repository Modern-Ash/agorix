import { describe, expect, it } from "vitest";
import { evaluateOriShadowFixtures } from "./oriShadowFixtureEvaluation.js";

describe("Ori MIG-03 fixture evaluator", () => {
  it("uses identical bounded input for independent evaluators", async () => {
    const seen: string[] = [];
    const report = await evaluateOriShadowFixtures({
      fixtures: [{ caseId: "first", mission: 1, hintLevel: 2, stage: "connect" }],
      legacy: async (input) => {
        seen.push(JSON.stringify(input));
        return { kind: "hint", hintLevel: 2 };
      },
      ori: async (input) => {
        seen.push(JSON.stringify(input));
        return { kind: "hint", hintLevel: 2 };
      },
    });
    expect(seen).toHaveLength(2);
    expect(seen[0]).toBe(seen[1]);
    expect(report.counts.parity).toBe(1);
  });
  it("rejects invalid levels before invoking either engine", async () => {
    let calls = 0;
    await expect(evaluateOriShadowFixtures({
      fixtures: [{ caseId: "invalid", mission: 1, hintLevel: 9, stage: "explore" }],
      legacy: async () => { calls++; return null; },
      ori: async () => { calls++; return null; },
    })).rejects.toThrow("Invalid Ori shadow fixture");
    expect(calls).toBe(0);
  });
});
