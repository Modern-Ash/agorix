import { describe, expect, it } from "vitest";
import { exportOriBlindReviewJson } from "./oriBlindReviewJsonExport.js";
import type { OriSeparatedBlindMessages } from "./oriSingleMessageBlindExport.js";

const capture: OriSeparatedBlindMessages = {
  educator: {
    schema: "agorix/ori-blind-messages/v1",
    missionId: "kids.m1.straight",
    A: "¿Qué bloque podrías probar primero?",
    B: "¿Qué movimiento te acerca a la meta?",
    equalInputContextProven: false,
    eligibleForEfficacyClaim: false,
  },
  coordinator: {
    missionId: "kids.m1.straight",
    oriCandidate: "A",
    deterministicCandidate: "B",
  },
};
describe("Ori offline blind review JSON export", () => {
  it("exports anonymous educator messages separately from restricted mapping", () => {
    const result = exportOriBlindReviewJson(capture);
    expect(JSON.parse(result!.educatorJson)).toEqual(capture.educator);
    expect(JSON.parse(result!.coordinatorJson)).toEqual(capture.coordinator);
    expect(result?.educatorJson).not.toContain("oriCandidate");
    expect(result?.educatorJson).not.toContain("deterministicCandidate");
  });
  it("preserves explicit unequal-context warnings", () => {
    const result = exportOriBlindReviewJson(capture);
    expect(JSON.parse(result!.educatorJson).equalInputContextProven).toBe(false);
    expect(JSON.parse(result!.educatorJson).eligibleForEfficacyClaim).toBe(false);
  });
  it("rejects mismatched mission IDs", () => {
    expect(
      exportOriBlindReviewJson({
        ...capture,
        coordinator: { ...capture.coordinator, missionId: "other" },
      }),
    ).toBeNull();
  });
  it("rejects malformed or duplicate source mappings", () => {
    expect(
      exportOriBlindReviewJson({
        ...capture,
        coordinator: { ...capture.coordinator, deterministicCandidate: "A" },
      }),
    ).toBeNull();
  });
  it("rejects unexpected educator fields", () => {
    expect(
      exportOriBlindReviewJson({
        ...capture,
        educator: { ...capture.educator, childId: "synthetic" },
      }),
    ).toBeNull();
  });
  it("rejects false efficacy claims", () => {
    expect(
      exportOriBlindReviewJson({
        ...capture,
        educator: { ...capture.educator, eligibleForEfficacyClaim: true },
      } as unknown as OriSeparatedBlindMessages),
    ).toBeNull();
  });
});
