import { describe, expect, it } from "vitest";
import { separateOriSingleMessageComparison } from "./oriSingleMessageBlindExport.js";
import type { OriSingleMessageComparison } from "./oriSingleMessageComparison.js";

const comparison: OriSingleMessageComparison = {
  schema: "agorix/ori-single-message-comparison/v1",
  missionId: "kids.m1.straight",
  A: "¿Qué bloque podrías probar para avanzar?",
  B: "¿Cómo podrías llegar a la meta con tus bloques?",
  provenance: { oriCandidate: "A", deterministicCandidate: "B" },
  equalInputContextProven: false,
  eligibleForEfficacyClaim: false,
};
describe("Ori single-message blind export", () => {
  it("exposes only anonymous A/B text to educators", () => {
    const result = separateOriSingleMessageComparison(comparison);
    expect(result?.educator.A).toBe(comparison.A);
    expect(result?.educator.B).toBe(comparison.B);
    expect(JSON.stringify(result?.educator)).not.toContain("oriCandidate");
    expect(JSON.stringify(result?.educator)).not.toContain("deterministicCandidate");
    expect(result?.coordinator.oriCandidate).toBe("A");
  });
  it("preserves explicit limits on efficacy claims", () => {
    const result = separateOriSingleMessageComparison(comparison);
    expect(result?.educator.equalInputContextProven).toBe(false);
    expect(result?.educator.eligibleForEfficacyClaim).toBe(false);
  });
  it("rejects invalid mapping or missing candidate text", () => {
    expect(separateOriSingleMessageComparison({
      ...comparison, provenance: { oriCandidate: "A", deterministicCandidate: "A" },
    })).toBeNull();
    expect(separateOriSingleMessageComparison({ ...comparison, A: "" })).toBeNull();
  });
  it("rejects fabricated equal-context claims", () => {
    expect(separateOriSingleMessageComparison({
      ...comparison, equalInputContextProven: true,
    } as unknown as OriSingleMessageComparison)).toBeNull();
  });
  it("returns frozen educator and coordinator objects", () => {
    const result = separateOriSingleMessageComparison(comparison);
    expect(Object.isFrozen(result?.educator)).toBe(true);
    expect(Object.isFrozen(result?.coordinator)).toBe(true);
  });
});
