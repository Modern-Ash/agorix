import { describe, expect, it } from "vitest";
import { buildOriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";
import type { OriMissionSemanticFinding } from "./oriMissionSemanticReport.js";

const comparison = (statuses: readonly ("match" | "divergence" | "not-comparable")[]) => ({
  fields: statuses.map((status, index) => ({
    field: (["actionFamily", "reviewRequired", "mutatesProgram", "pedagogicalHintLevel"] as const)[index]!,
    status,
  })),
  comparableFields: statuses.filter((status) => status !== "not-comparable").length,
  matchingFields: statuses.filter((status) => status === "match").length,
  matchRate: null,
});
describe("Ori MIG-03 mission divergence matrix", () => {
  it("separates missing, divergence and partial matches", () => {
    const findings: OriMissionSemanticFinding[] = [
      { missionId: "a", missionIndex: 0, candidateAvailable: false, comparison: null },
      { missionId: "b", missionIndex: 1, candidateAvailable: true,
        comparison: comparison(["match", "divergence", "not-comparable"]) },
      { missionId: "c", missionIndex: 2, candidateAvailable: true,
        comparison: comparison(["match", "not-comparable"]) },
    ];
    const matrix = buildOriMissionDivergenceMatrix(findings);
    expect(matrix.total).toBe(3);
    expect(matrix.available).toBe(2);
    expect(matrix.missing).toBe(1);
    expect(matrix.divergent).toBe(1);
    expect(matrix.rows.map((row) => row.status)).toEqual(["missing", "divergent", "partial-match"]);
  });
});
