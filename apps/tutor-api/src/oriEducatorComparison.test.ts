import { describe, expect, it } from "vitest";
import { summarizeOriEducatorRating, type OriEducatorRating } from "./oriEducatorComparison.js";

const rating: OriEducatorRating = {
  fixtureId: "movement-01",
  candidate: "A",
  scores: {
    clarity: 4,
    learnerAgency: 5,
    scaffolding: 4,
    contextRelevance: 4,
    ageAppropriateness: 5,
  },
  unsafe: false,
  rationale: "Invita a explorar el movimiento sin revelar la solución.",
};
describe("Ori educator blind comparison rubric", () => {
  it("summarizes five rated dimensions", () => {
    expect(summarizeOriEducatorRating(rating)).toEqual({
      fixtureId: "movement-01",
      candidate: "A",
      meanScore: 4.4,
      eligibleForReview: true,
      safetyFlag: false,
    });
  });
  it("keeps unsafe candidate ineligible regardless of scores", () => {
    expect(summarizeOriEducatorRating({ ...rating, unsafe: true })).toMatchObject({
      eligibleForReview: false,
      safetyFlag: true,
    });
  });
  it("rejects invalid scores", () => {
    expect(
      summarizeOriEducatorRating({
        ...rating,
        scores: { ...rating.scores, clarity: 6 },
      } as unknown as OriEducatorRating),
    ).toBeNull();
  });
  it("rejects missing dimensions", () => {
    const scores = { clarity: 4 };
    expect(
      summarizeOriEducatorRating({
        ...rating,
        scores,
      } as unknown as OriEducatorRating),
    ).toBeNull();
  });
  it("rejects extra dimensions", () => {
    expect(
      summarizeOriEducatorRating({
        ...rating,
        scores: { ...rating.scores, hiddenMetric: 5 },
      } as unknown as OriEducatorRating),
    ).toBeNull();
  });
  it("rejects ratings without an explanatory rationale", () => {
    expect(summarizeOriEducatorRating({ ...rating, rationale: "OK" })).toBeNull();
  });
  it("supports blinded candidate B without identifying a provider", () => {
    expect(summarizeOriEducatorRating({ ...rating, candidate: "B" })?.candidate).toBe("B");
  });
});
