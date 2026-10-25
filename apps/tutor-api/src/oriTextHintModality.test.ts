import { describe, expect, it } from "vitest";
import { toOriTextHintCandidate } from "./oriTextHintModality.js";
import type { OriLearnerHintPreview } from "./oriLearnerHintPreview.js";

const valid: OriLearnerHintPreview = {
  status: "ready",
  hint: "¿Qué bloque podrías probar para avanzar?",
  nextStep: "Elegí una opción y observá qué sucede.",
  requiresLearnerApproval: true,
  appliedChanges: false,
};
describe("Ori text-only pedagogical hint modality", () => {
  it("extracts an immutable text-only candidate", () => {
    expect(toOriTextHintCandidate(valid)).toEqual({
      schema: "agorix/pedagogical-text-hint/v1",
      hint: valid.hint,
      nextStep: valid.nextStep,
      appliedChanges: false,
    });
  });
  it("rejects disabled or unavailable preview", () => {
    expect(
      toOriTextHintCandidate({
        status: "unavailable",
        requiresLearnerApproval: true,
        appliedChanges: false,
      }),
    ).toBeNull();
  });
  it("rejects executable proposal fields", () => {
    expect(toOriTextHintCandidate({ ...valid, proposal: { apply: true } } as unknown as OriLearnerHintPreview)).toBeNull();
  });
  it("rejects claimed mutation or missing approval", () => {
    expect(
      toOriTextHintCandidate({
        ...valid,
        appliedChanges: true,
      } as unknown as OriLearnerHintPreview),
    ).toBeNull();
    expect(
      toOriTextHintCandidate({
        ...valid,
        requiresLearnerApproval: false,
      } as unknown as OriLearnerHintPreview),
    ).toBeNull();
  });
  it("rejects extra learner data and excessive text", () => {
    expect(toOriTextHintCandidate({ ...valid, childId: "synthetic" } as unknown as OriLearnerHintPreview)).toBeNull();
    expect(toOriTextHintCandidate({ ...valid, hint: "x".repeat(181) })).toBeNull();
  });
});
