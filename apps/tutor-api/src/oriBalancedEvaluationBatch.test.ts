import { describe, expect, it } from "vitest";
import { prepareOriBalancedEvaluationBatch } from "./oriBalancedEvaluationBatch.js";
import { oriPedagogicalFixtures } from "./oriPedagogicalFixtures.js";

const ori = {
  hint: "¿Qué bloque usarías para probar tu idea?",
  nextStep: "Probá una opción y observá el resultado.",
};
const deterministic = {
  hint: "Pensá qué bloque puede ayudarte ahora.",
  nextStep: "Elegí un bloque y comprobá qué sucede.",
};
const cases = oriPedagogicalFixtures.map((fixture) => ({ fixture, ori, deterministic }));
describe("Ori balanced educator evaluation batches", () => {
  it("alternates source assignment across five scenarios", () => {
    const batch = prepareOriBalancedEvaluationBatch(cases);
    expect(batch?.keys.map((key) => key.oriCandidate)).toEqual(["A", "B", "A", "B", "A"]);
    expect(batch?.pairs).toHaveLength(5);
  });
  it("supports the inverse assignment", () => {
    const batch = prepareOriBalancedEvaluationBatch(cases, false);
    expect(batch?.keys.map((key) => key.oriCandidate)).toEqual(["B", "A", "B", "A", "B"]);
  });
  it("keeps source mapping out of educator-facing pairs", () => {
    const batch = prepareOriBalancedEvaluationBatch(cases);
    expect(JSON.stringify(batch?.pairs)).not.toContain("oriCandidate");
    expect(JSON.stringify(batch?.pairs)).not.toContain("deterministicCandidate");
  });
  it("rejects duplicate fixture identifiers", () => {
    expect(prepareOriBalancedEvaluationBatch([cases[0]!, cases[0]!])).toBeNull();
  });
  it("rejects an empty batch", () => {
    expect(prepareOriBalancedEvaluationBatch([])).toBeNull();
  });
  it("rejects malformed candidate content", () => {
    const invalid = { ...cases[0]!, ori: { ...ori, hint: "" } };
    expect(prepareOriBalancedEvaluationBatch([invalid])).toBeNull();
  });
  it("returns immutable arrays", () => {
    const batch = prepareOriBalancedEvaluationBatch(cases);
    expect(Object.isFrozen(batch?.pairs)).toBe(true);
    expect(Object.isFrozen(batch?.keys)).toBe(true);
  });
});
