import { describe, expect, it } from "vitest";
import type { OriPlanConsumer } from "./oriPlanConsumer.js";
import { createOriRealPlanShadowEvaluator } from "./oriRealPlanShadowEvaluator.js";

describe("Ori real plan shadow evaluator", () => {
  it("adapts a validated Ori plan without mutating the project", async () => {
    const received: unknown[] = [];
    const consumer: OriPlanConsumer = {
      evaluate: async (input) => {
        received.push(input);
        return {
          schema: "ori/shadow-plan/v1",
          kind: "pedagogical-plan",
          stage: 2,
          steps: ["Predecir", "Probar", "Comparar"],
          hint: "¿Qué esperás que pase?",
          requiresLearnerApproval: false,
          appliedChanges: false,
          context: { missionStage: 1 },
        };
      },
    };
    const evaluate = createOriRealPlanShadowEvaluator(consumer, 3);
    expect(await evaluate({ mission: 1, hintLevel: 2, stage: "connect" })).toEqual({
      kind: "pedagogical-plan",
      hintLevel: 2,
    });
    expect(received).toEqual([{ missionIndex: 1, hintLevel: 2, scriptCount: 3 }]);
  });
  it("fails closed for missing and mismatched plans", async () => {
    const consumer: OriPlanConsumer = { evaluate: async () => null };
    const evaluate = createOriRealPlanShadowEvaluator(consumer);
    expect(await evaluate({ mission: 1, hintLevel: 2, stage: "connect" })).toBeNull();
    expect(await evaluate({ mission: -1, hintLevel: 2, stage: "connect" })).toBeNull();
    expect(() => createOriRealPlanShadowEvaluator(consumer, -1)).toThrow(RangeError);
  });
});
