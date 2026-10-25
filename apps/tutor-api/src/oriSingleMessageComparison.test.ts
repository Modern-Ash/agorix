import { describe, expect, it } from "vitest";
import { prepareOriSingleMessageComparison } from "./oriSingleMessageComparison.js";
import type { OriRealTextBaseline } from "./oriRealTextBaseline.js";
import type { OriLearnerHintPreview } from "./oriLearnerHintPreview.js";

const baseline: OriRealTextBaseline = {
  source: "agorix-deterministic-text",
  missionId: "kids.m1.straight",
  hintLevel: 2,
  message: "¿Qué bloque te ayudaría a llegar a la meta?",
  nextStepAvailable: false,
  programUnchanged: true,
};
const preview: OriLearnerHintPreview = {
  status: "ready",
  hint: "¿Qué movimiento podrías probar primero?",
  nextStep: "Probá un bloque y observá qué sucede.",
  requiresLearnerApproval: true,
  appliedChanges: false,
};
describe("Ori exploratory single-message comparison", () => {
  it("preserves authentic message and hint without synthesizing a next step", () => {
    const result = prepareOriSingleMessageComparison(baseline, preview, true);
    expect(result?.A).toBe(preview.hint);
    expect(result?.B).toBe(baseline.message);
    expect(result?.equalInputContextProven).toBe(false);
    expect(result?.eligibleForEfficacyClaim).toBe(false);
    expect(result?.provenance.oriCandidate).toBe("A");
  });
  it("reverses blinded ordering without changing content", () => {
    const result = prepareOriSingleMessageComparison(baseline, preview, false);
    expect(result?.A).toBe(baseline.message);
    expect(result?.B).toBe(preview.hint);
    expect(result?.provenance.oriCandidate).toBe("B");
  });
  it("rejects unavailable Ori preview", () => {
    expect(
      prepareOriSingleMessageComparison(baseline, { ...preview, status: "unavailable" }, true),
    ).toBeNull();
  });
  it("rejects claimed program mutation", () => {
    expect(
      prepareOriSingleMessageComparison(
        baseline,
        { ...preview, appliedChanges: true } as unknown as OriLearnerHintPreview,
        true,
      ),
    ).toBeNull();
  });
  it("rejects invalid or unverified baseline", () => {
    expect(
      prepareOriSingleMessageComparison({ ...baseline, programUnchanged: false }, preview, true),
    ).toBeNull();
  });
  it("does not expose a full Ori plan or nextStep in the comparison", () => {
    const result = prepareOriSingleMessageComparison(baseline, preview, true);
    expect(Object.keys(result!).sort()).toEqual([
      "A",
      "B",
      "eligibleForEfficacyClaim",
      "equalInputContextProven",
      "missionId",
      "provenance",
      "schema",
    ]);
    expect(JSON.stringify(result)).not.toContain("nextStep");
  });
});
