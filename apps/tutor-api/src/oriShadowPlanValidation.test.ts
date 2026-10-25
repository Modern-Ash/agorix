import { describe, expect, it } from "vitest";
import { validateOriShadowPlan } from "./oriShadowPlanValidation.js";
const valid = {
  schema: "ori/shadow-plan/v1",
  kind: "pedagogical-plan",
  stage: 2,
  steps: ["Predecir", "Probar", "Reflexionar"],
  hint: "¿Qué esperás que pase?",
  requiresLearnerApproval: false,
  appliedChanges: false,
  context: { missionStage: 1 },
};
describe("Ori shadow plan schema", () => {
  it("accepts the current Ori v1 plan shape", () => {
    expect(validateOriShadowPlan(valid)).toEqual(valid);
  });
  it("rejects hidden proposals, edits and extra child data", () => {
    expect(validateOriShadowPlan({ ...valid, proposal: { operation: "append" } })).toBeNull();
    expect(validateOriShadowPlan({ ...valid, appliedChanges: true })).toBeNull();
    expect(validateOriShadowPlan({ ...valid, childMessage: "private" })).toBeNull();
    expect(validateOriShadowPlan({ ...valid, context: { missionStage: 1, identity: "child" } })).toBeNull();
  });
  it("rejects invalid stage, oversized text and malformed steps", () => {
    expect(validateOriShadowPlan({ ...valid, stage: 6 })).toBeNull();
    expect(validateOriShadowPlan({ ...valid, hint: "x".repeat(181) })).toBeNull();
    expect(validateOriShadowPlan({ ...valid, steps: ["one"] })).toBeNull();
  });
});
