import { describe, expect, it } from "vitest";
import { captureOriDeterministicBaseline } from "./oriDeterministicBaseline.js";
import { projectLegacyOriOffer, projectOriShadowPlan } from "./oriSemanticProjection.js";

describe("Ori MIG-03 shared semantic projection", () => {
  it("retains unknown pedagogical fields for real deterministic offers", () => {
    const records = captureOriDeterministicBaseline();
    expect(records.length).toBeGreaterThan(0);
    for (const record of records) {
      const projected = projectLegacyOriOffer(record);
      expect(projected.source).toBe("legacy-action");
      expect(projected.pedagogicalHintLevel).toBeNull();
      expect(projected.mutatesProgram).toBe(false);
    }
  });
  it("projects Ori plan without inventing action equivalence", () => {
    const projected = projectOriShadowPlan({
      schema: "ori/shadow-plan/v1",
      kind: "pedagogical-plan",
      stage: 2,
      steps: ["Predecir", "Probar", "Comparar"],
      hint: "¿Qué esperás que pase?",
      requiresLearnerApproval: false,
      appliedChanges: false,
      context: { missionStage: 1 },
    });
    expect(projected.source).toBe("ori-plan");
    expect(projected.actionFamily).toBe("unknown");
    expect(projected.pedagogicalHintLevel).toBe(2);
    expect(projected.mutatesProgram).toBe(false);
  });
});
