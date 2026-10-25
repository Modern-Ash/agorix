import { describe, expect, it } from "vitest";
import { prepareOriBlindComparisonPair } from "./oriBlindComparisonPairs.js";
import { oriPedagogicalFixtures } from "./oriPedagogicalFixtures.js";

const fixture = oriPedagogicalFixtures[0]!;
const ori = {
  hint: "¿Qué bloque te ayudaría a mover el personaje?",
  nextStep: "Probá un movimiento y observá qué ocurre.",
};
const deterministic = {
  hint: "Observá qué ocurre cuando movés el personaje.",
  nextStep: "Elegí un bloque de movimiento y probalo.",
};
describe("Ori blinded pedagogical comparison pairs", () => {
  it("places Ori in A when explicitly selected", () => {
    const bundle = prepareOriBlindComparisonPair(fixture, ori, deterministic, true);
    expect(bundle?.pair.A).toEqual(ori);
    expect(bundle?.pair.B).toEqual(deterministic);
    expect(bundle?.key).toEqual({
      fixtureId: fixture.id, oriCandidate: "A", deterministicCandidate: "B",
    });
  });
  it("places Ori in B when explicitly selected", () => {
    const bundle = prepareOriBlindComparisonPair(fixture, ori, deterministic, false);
    expect(bundle?.pair.A).toEqual(deterministic);
    expect(bundle?.pair.B).toEqual(ori);
    expect(bundle?.key.oriCandidate).toBe("B");
  });
  it("does not leak tutor names into the blind pair structure", () => {
    const bundle = prepareOriBlindComparisonPair(fixture, ori, deterministic, true);
    expect(Object.keys(bundle!.pair).sort()).toEqual(["A", "B", "fixtureId", "topic"]);
    expect(JSON.stringify(bundle!.pair)).not.toContain("oriCandidate");
    expect(JSON.stringify(bundle!.pair)).not.toContain("deterministicCandidate");
  });
  it("rejects invalid or empty hints", () => {
    expect(prepareOriBlindComparisonPair(fixture, { ...ori, hint: "" }, deterministic, true)).toBeNull();
  });
  it("rejects oversized content", () => {
    expect(prepareOriBlindComparisonPair(fixture, { ...ori, hint: "x".repeat(181) }, deterministic, true)).toBeNull();
  });
  it("copies and freezes candidate output", () => {
    const bundle = prepareOriBlindComparisonPair(fixture, ori, deterministic, true);
    expect(Object.isFrozen(bundle?.pair.A)).toBe(true);
    expect(Object.isFrozen(bundle?.pair.B)).toBe(true);
  });
});
