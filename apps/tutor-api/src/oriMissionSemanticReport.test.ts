import { describe, expect, it } from "vitest";
import { compareOriMissionBaselines } from "./oriMissionSemanticReport.js";
import type { OriShadowPlan } from "./oriShadowPlanValidation.js";

describe("Ori MIG-03 real baseline mission comparison", () => {
  it("does not fabricate parity when Ori plans are missing", () => {
    const findings = compareOriMissionBaselines(new Map());
    expect(findings.length).toBeGreaterThan(0);
    expect(findings.every((entry) => !entry.candidateAvailable && entry.comparison === null)).toBe(true);
  });
  it("compares observable properties for a correctly keyed plan", () => {
    const plan: OriShadowPlan = {
      schema: "ori/shadow-plan/v1",
      kind: "pedagogical-plan",
      stage: 2,
      steps: ["Predecir", "Probar", "Comparar"],
      hint: "¿Qué esperás que pase?",
      requiresLearnerApproval: false,
      appliedChanges: false,
      context: { missionStage: 0 },
    };
    const findings = compareOriMissionBaselines(new Map([[0, plan]]));
    expect(findings[0]?.candidateAvailable).toBe(true);
    expect(findings[0]?.comparison?.fields.find((field) => field.field === "actionFamily")?.status)
      .toBe("not-comparable");
    expect(findings.slice(1).every((entry) => entry.comparison === null)).toBe(true);
  });
});
