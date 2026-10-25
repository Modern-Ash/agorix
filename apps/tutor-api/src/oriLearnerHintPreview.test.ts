import { describe, expect, it } from "vitest";
import { createOriLearnerHintPreview } from "./oriLearnerHintPreview.js";
import type { OriPlanConsumer } from "./oriPlanConsumer.js";

const input = { missionIndex: 1, hintLevel: 2 as const, scriptCount: 1 };
const plan = {
  schema: "ori/shadow-plan/v1" as const,
  kind: "pedagogical-plan" as const,
  stage: 2 as const,
  steps: ["Predecí qué va a pasar", "Probá tu idea", "Compará el resultado"] as const,
  hint: "¿Qué bloque movería al personaje?",
  requiresLearnerApproval: false as const,
  appliedChanges: false as const,
  context: { missionStage: 1 },
};
describe("Ori learner hint preview", () => {
  it("does not invoke Ori while disabled", async () => {
    let calls = 0;
    const consumer: OriPlanConsumer = {
      evaluate: async () => {
        calls++;
        return plan;
      },
    };
    expect(await createOriLearnerHintPreview(consumer)(input)).toEqual({
      status: "unavailable",
      requiresLearnerApproval: true,
      appliedChanges: false,
    });
    expect(calls).toBe(0);
  });
  it("returns only a hint and first step, not the full plan", async () => {
    const consumer: OriPlanConsumer = { evaluate: async () => plan };
    expect(await createOriLearnerHintPreview(consumer, true)(input)).toEqual({
      status: "ready",
      hint: plan.hint,
      nextStep: plan.steps[0],
      requiresLearnerApproval: true,
      appliedChanges: false,
    });
  });
  it.each([
    ["mission mismatch", { ...plan, context: { missionStage: 2 } }],
    ["stage mismatch", { ...plan, stage: 3 }],
    ["claimed mutation", { ...plan, appliedChanges: true }],
    ["extra executable proposal", { ...plan, proposal: { apply: true } }],
    ["unsafe long hint", { ...plan, hint: "x".repeat(181) }],
  ])("fails closed on %s", async (_label, invalid) => {
    const consumer: OriPlanConsumer = {
      evaluate: async () => invalid as unknown as Awaited<ReturnType<OriPlanConsumer["evaluate"]>>,
    };
    expect((await createOriLearnerHintPreview(consumer, true)(input)).status).toBe("unavailable");
  });
  it("returns unavailable on provider failure", async () => {
    const consumer: OriPlanConsumer = {
      evaluate: async () => {
        throw new Error("synthetic");
      },
    };
    expect((await createOriLearnerHintPreview(consumer, true)(input)).status).toBe("unavailable");
  });
});
