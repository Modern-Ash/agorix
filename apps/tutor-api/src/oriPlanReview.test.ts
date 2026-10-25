import { describe, expect, it } from "vitest";
import { createOriPlanReview } from "./oriPlanReview.js";
import type { OriPlanConsumer } from "./oriPlanConsumer.js";

const input = { missionIndex: 1, hintLevel: 2 as const, scriptCount: 1 };
const plan = {
  schema: "ori/shadow-plan/v1" as const,
  kind: "pedagogical-plan" as const,
  stage: 2 as const,
  steps: ["Predecir", "Probar", "Comparar"] as [string, string, string],
  hint: "¿Qué esperás que pase?",
  requiresLearnerApproval: false as const,
  appliedChanges: false as const,
  context: { missionStage: 1 },
};
describe("Ori adult-only plan review boundary", () => {
  it("never calls Ori while disabled", async () => {
    let calls = 0;
    const consumer: OriPlanConsumer = { evaluate: async () => { calls++; return plan; } };
    expect(await createOriPlanReview(consumer, false)(input)).toEqual({
      status: "unavailable", plan: null, appliedChanges: false,
    });
    expect(calls).toBe(0);
  });
  it("returns a validated internal plan for explicit review", async () => {
    const consumer: OriPlanConsumer = { evaluate: async () => plan };
    expect(await createOriPlanReview(consumer, true)(input)).toEqual({
      status: "ready", plan, appliedChanges: false,
    });
  });
  it("fails closed on unavailable producer", async () => {
    const consumer: OriPlanConsumer = { evaluate: async () => null };
    expect((await createOriPlanReview(consumer, true)(input)).status).toBe("unavailable");
  });
  it("isolates unexpected consumer errors", async () => {
    const consumer: OriPlanConsumer = { evaluate: async () => { throw new Error("synthetic provider failure"); } };
    expect((await createOriPlanReview(consumer, true)(input)).plan).toBeNull();
  });
});
