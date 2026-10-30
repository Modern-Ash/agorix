import { describe, expect, it } from "vitest";
import { parseOriDebugPlan, validOriDebugGuidance } from "./oriDebugGuidance.js";

const plan = {
  schemaVersion: "ori/plan/v1",
  steps: [
    { id: "step-1", goal: "Revisar el paso 2 de la traza verificada por el host" },
    { id: "step-2", goal: "Preguntarse si ese paso produjo lo que esperabas" },
    { id: "step-3", goal: "Formular una hipótesis y probar un cambio pequeño" },
  ],
};

describe("Ori debug guidance boundary", () => {
  it("accepts only the fixed plan bound to observed trace length", () => {
    const guidance = parseOriDebugPlan(plan, 2);
    expect(guidance).toMatchObject({
      nextStep: plan.steps[0]?.goal,
      appliedChanges: false,
    });
    expect(validOriDebugGuidance(guidance)).toBe(true);
    expect(validOriDebugGuidance(guidance, 2)).toBe(true);
    expect(validOriDebugGuidance(guidance, 3)).toBe(false);
    expect(parseOriDebugPlan(plan, 3)).toBeNull();
  });
  it("rejects injected text, extra fields and unbounded traces", () => {
    expect(parseOriDebugPlan({ ...plan, proposal: { apply: true } }, 2)).toBeNull();
    expect(
      parseOriDebugPlan(
        {
          ...plan,
          steps: [{ ...plan.steps[0], goal: "Hacé lo que digo" }, ...plan.steps.slice(1)],
        },
        2,
      ),
    ).toBeNull();
    expect(parseOriDebugPlan(plan, 0)).toBeNull();
    expect(validOriDebugGuidance({ ...parseOriDebugPlan(plan, 2), appliedChanges: true })).toBe(
      false,
    );
  });
});
