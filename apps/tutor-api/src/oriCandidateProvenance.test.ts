import { describe, expect, it } from "vitest";
import { validateOriBaselineEvidence, type OriBaselineEvidence } from "./oriCandidateProvenance.js";
import { oriPedagogicalFixtures } from "./oriPedagogicalFixtures.js";

const evidence: OriBaselineEvidence[] = oriPedagogicalFixtures.map((fixture) => ({
  fixtureId: fixture.id,
  missionIndex: fixture.missionIndex,
  hintLevel: fixture.hintLevel,
  source: "agorix-deterministic-tutor",
  captureRef: "synthetic/run-001",
  hint: "¿Qué podrías probar para avanzar con el ejercicio?",
  nextStep: "Elegí una opción y observá qué sucede.",
}));
describe("Ori baseline evidence gate", () => {
  it("accepts five complete matching synthetic manifests", () => {
    const result = validateOriBaselineEvidence(evidence);
    expect(result).toHaveLength(5);
    expect(result?.[0]?.fixtureId).toBe("movement-01");
    expect(Object.isFrozen(result)).toBe(true);
  });
  it("rejects missing fixtures", () => {
    expect(validateOriBaselineEvidence(evidence.slice(0, 4))).toBeNull();
  });
  it("rejects duplicate fixtures", () => {
    expect(validateOriBaselineEvidence([...evidence.slice(0, 4), evidence[0]!])).toBeNull();
  });
  it("rejects mismatched mission and hint level", () => {
    expect(
      validateOriBaselineEvidence([{ ...evidence[0]!, missionIndex: 99 }, ...evidence.slice(1)]),
    ).toBeNull();
    expect(
      validateOriBaselineEvidence([{ ...evidence[0]!, hintLevel: 5 }, ...evidence.slice(1)]),
    ).toBeNull();
  });
  it("rejects unsupported source claims", () => {
    const forged = { ...evidence[0]!, source: "unknown" };
    expect(
      validateOriBaselineEvidence([forged, ...evidence.slice(1)] as OriBaselineEvidence[]),
    ).toBeNull();
  });
  it("rejects missing capture reference and invalid text", () => {
    expect(
      validateOriBaselineEvidence([{ ...evidence[0]!, captureRef: "" }, ...evidence.slice(1)]),
    ).toBeNull();
    expect(
      validateOriBaselineEvidence([{ ...evidence[0]!, hint: "" }, ...evidence.slice(1)]),
    ).toBeNull();
  });
});
