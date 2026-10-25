import { describe, expect, it } from "vitest";
import { validateOriShadowPlan } from "./oriShadowPlanValidation.js";

/**
 * Consumer-driven contract fixtures mirroring Modern-Ash/ori PR #47.
 * Keep these synthetic: no child text, programs or identifiers.
 */
const stages = [
  ["Pensar qué queremos lograr", "Elegir una acción pequeña", "Probar y observar"],
  ["Predecir el resultado", "Revisar un paso", "Comparar con lo esperado"],
  ["Identificar el problema", "Cambiar una instrucción", "Ejecutar otra vez"],
  ["Explicar el cambio", "Probar otra alternativa", "Comparar resultados"],
  ["Justificar la solución", "Explorar una variante", "Reflexionar sobre lo aprendido"],
] as const;

function producerFixture(missionIndex: number, hintLevel: number, scriptCount: number) {
  return {
    schema: "ori/shadow-plan/v1",
    kind: "pedagogical-plan",
    stage: hintLevel,
    steps: stages[hintLevel - 1],
    hint: scriptCount === 0
      ? "¿Qué acción pequeña querés probar primero?"
      : "¿Qué esperás que pase si ejecutás tu programa?",
    requiresLearnerApproval: false,
    appliedChanges: false,
    context: { missionStage: missionIndex },
  };
}

describe("Ori producer/Agorix consumer shadow-plan parity", () => {
  it("accepts all five documented pedagogical stages", () => {
    for (let stage = 1; stage <= 5; stage++) {
      const result = validateOriShadowPlan(producerFixture(0, stage, 1));
      expect(result?.stage).toBe(stage);
      expect(result?.steps).toHaveLength(3);
    }
  });

  it("accepts empty and nonempty synthetic programs", () => {
    expect(validateOriShadowPlan(producerFixture(1, 1, 0))?.hint)
      .toContain("acción pequeña");
    expect(validateOriShadowPlan(producerFixture(1, 1, 2))?.hint)
      .toContain("ejecutás");
  });

  it("rejects changed schema and added privileged fields", () => {
    const base = producerFixture(0, 1, 1);
    expect(validateOriShadowPlan({ ...base, schema: "ori/shadow-plan/v2" })).toBeNull();
    expect(validateOriShadowPlan({ ...base, proposal: { apply: true } })).toBeNull();
    expect(validateOriShadowPlan({ ...base, childId: "secret" })).toBeNull();
  });
});
