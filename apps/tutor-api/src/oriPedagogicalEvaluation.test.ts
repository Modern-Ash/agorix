import { describe, expect, it } from "vitest";
import { assessOriPedagogicalPlan } from "./oriPedagogicalEvaluation.js";
import { oriPedagogicalFixtures } from "./oriPedagogicalFixtures.js";

const movement = oriPedagogicalFixtures[0]!;
const plan = {
  schema: "ori/shadow-plan/v1",
  kind: "pedagogical-plan",
  stage: 2,
  steps: ["Pensá cómo mover al personaje", "Probá un bloque", "Observá el resultado"],
  hint: "¿Qué bloque puede mover al personaje?",
  requiresLearnerApproval: false,
  appliedChanges: false,
  context: { missionStage: 1 },
};
describe("Ori pedagogical fixture pre-screening", () => {
  it("covers five Scratch-inspired topics", () => {
    expect(oriPedagogicalFixtures.map((item) => item.topic)).toEqual([
      "movement", "sequence", "loops", "events", "debugging",
    ]);
  });
  it("accepts a matching exploratory hint", () => {
    expect(assessOriPedagogicalPlan(movement, plan)).toEqual({
      fixtureId: "movement-01", accepted: true, reasons: [],
    });
  });
  it("rejects full-solution leakage", () => {
    const result = assessOriPedagogicalPlan(movement, {
      ...plan, hint: "Copiá este código para mover al personaje",
    });
    expect(result.reasons).toContain("solution-leakage");
  });
  it("rejects missing topic relevance", () => {
    const result = assessOriPedagogicalPlan(movement, {
      ...plan, hint: "¿Qué pasará ahora?", steps: ["Pensá", "Probá", "Observá"],
    });
    expect(result.reasons).toContain("missing-learning-concept");
  });
  it("rejects context mismatch", () => {
    const result = assessOriPedagogicalPlan(movement, {
      ...plan, context: { missionStage: 2 },
    });
    expect(result.reasons).toContain("context-mismatch");
  });
  it("rejects invalid schema", () => {
    expect(assessOriPedagogicalPlan(movement, { ...plan, appliedChanges: true }).reasons)
      .toContain("invalid-contract");
  });
});
