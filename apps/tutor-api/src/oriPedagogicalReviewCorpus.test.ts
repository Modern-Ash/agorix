import { describe, expect, it } from "vitest";
import { buildOriPedagogicalReviewCorpus } from "./oriPedagogicalReviewCorpus.js";
import type { OriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";

const matrix: OriMissionDivergenceMatrix = {
  total: 3,
  available: 2,
  missing: 1,
  divergent: 1,
  rows: [
    {
      missionId: "missing",
      missionIndex: 0,
      status: "missing",
      matches: 0,
      divergences: 0,
      notComparable: 0,
    },
    {
      missionId: "different",
      missionIndex: 1,
      status: "divergent",
      matches: 1,
      divergences: 1,
      notComparable: 2,
    },
    {
      missionId: "partial",
      missionIndex: 2,
      status: "partial-match",
      matches: 2,
      divergences: 0,
      notComparable: 2,
    },
  ],
};
describe("MIG-03 pedagogical review corpus", () => {
  it("includes every mission and prioritizes missing and divergent evidence", () => {
    const corpus = buildOriPedagogicalReviewCorpus(matrix);
    expect(corpus).toHaveLength(3);
    expect(corpus.map((item) => item.priority)).toEqual(["high", "high", "normal"]);
    expect(corpus.every((item) => item.outcome === "pending-human-review")).toBe(true);
    expect(corpus.every((item) => item.criteria.length === 5)).toBe(true);
  });
  it("does not turn observable technical matches into educator approval", () => {
    const corpus = buildOriPedagogicalReviewCorpus({
      total: 1,
      available: 1,
      missing: 0,
      divergent: 0,
      rows: [
        {
          missionId: "match",
          missionIndex: 0,
          status: "matched-observables",
          matches: 4,
          divergences: 0,
          notComparable: 0,
        },
      ],
    });
    expect(corpus[0]?.outcome).toBe("pending-human-review");
  });
});
