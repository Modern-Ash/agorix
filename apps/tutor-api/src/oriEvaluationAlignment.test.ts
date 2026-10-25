import { describe, expect, it } from "vitest";
import { KIDS_MISSION_IDS } from "@agorix/curriculum";
import { buildOriEvaluationAlignmentMatrix } from "./oriEvaluationAlignment.js";

describe("Ori pedagogical alignment matrix", () => {
  it("covers all five Scratch-inspired fixtures", () => {
    const matrix = buildOriEvaluationAlignmentMatrix();
    expect(matrix.map((row) => row.fixtureId)).toEqual([
      "movement-01", "sequence-01", "loops-01", "events-01", "debugging-01",
    ]);
  });
  it("maps only actual canonical Kids mission indices", () => {
    const matrix = buildOriEvaluationAlignmentMatrix();
    for (const row of matrix) {
      expect(row.canonicalMissionId).toBe(KIDS_MISSION_IDS[row.missionIndex] ?? null);
      if (row.canonicalMissionId === null)
        expect(row.blockers).toContain("no-canonical-kids-mission");
    }
  });
  it("never claims equal full program context or comparable text", () => {
    const matrix = buildOriEvaluationAlignmentMatrix();
    expect(matrix.every((row) => !row.sameProgramContextProven)).toBe(true);
    expect(matrix.every((row) => !row.comparableTextOutputsProven)).toBe(true);
    expect(matrix.every((row) => !row.eligibleForBlindStudy)).toBe(true);
  });
  it("records both unresolved methodological blockers", () => {
    for (const row of buildOriEvaluationAlignmentMatrix()) {
      expect(row.blockers).toContain("ori-shadow-does-not-receive-full-program");
      expect(row.blockers).toContain("deterministic-offer-is-not-text-hint");
    }
  });
  it("returns immutable and reproducible matrix rows", () => {
    const matrix = buildOriEvaluationAlignmentMatrix();
    expect(matrix).toEqual(buildOriEvaluationAlignmentMatrix());
    expect(Object.isFrozen(matrix)).toBe(true);
    expect(matrix.every((row) => Object.isFrozen(row) && Object.isFrozen(row.blockers))).toBe(true);
  });
});
