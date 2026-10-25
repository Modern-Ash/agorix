import { describe, expect, it } from "vitest";
import { parseOriEducatorReportJson, serializeOriEducatorReport } from "./oriEducatorReportJson.js";

const input = {
  keys: [{ fixtureId: "movement-01", oriCandidate: "A", deterministicCandidate: "B" }],
  submissions: (["A", "B"] as const).map((candidate) => ({
    reviewerId: "educator1",
    rating: {
      fixtureId: "movement-01",
      candidate,
      scores: {
        clarity: 4,
        learnerAgency: 4,
        scaffolding: 4,
        contextRelevance: 4,
        ageAppropriateness: 4,
      },
      unsafe: false,
      rationale: "Evaluación sintética explicada para el ejercicio.",
    },
  })),
};
describe("Ori educator report JSON import", () => {
  it("imports and serializes a complete paired evaluation", () => {
    const report = parseOriEducatorReportJson(JSON.stringify(input));
    expect(report?.fixtureCount).toBe(1);
    expect(report?.totalPairedReviews).toBe(1);
    expect(JSON.parse(serializeOriEducatorReport(report!))).toEqual(report);
  });
  it("does not export restricted source keys or reviewer IDs", () => {
    const report = parseOriEducatorReportJson(JSON.stringify(input));
    const serialized = serializeOriEducatorReport(report!);
    expect(serialized).not.toContain("oriCandidate");
    expect(serialized).not.toContain("reviewerId");
    expect(serialized).not.toContain("educator1");
  });
  it.each(["{broken", "[]", "null", JSON.stringify({ ...input, extra: true })])(
    "rejects malformed or unexpected JSON",
    (raw) => {
      expect(parseOriEducatorReportJson(raw)).toBeNull();
    },
  );
  it("rejects oversized imports", () => {
    expect(parseOriEducatorReportJson(JSON.stringify(input) + " ".repeat(65_536))).toBeNull();
  });
  it("rejects incomplete paired ratings", () => {
    expect(
      parseOriEducatorReportJson(
        JSON.stringify({
          ...input,
          submissions: input.submissions.slice(0, 1),
        }),
      ),
    ).toBeNull();
  });
  it.each([0, 1023, 1_048_577, Number.NaN])("rejects invalid import cap %s", (limit) => {
    expect(() => parseOriEducatorReportJson(JSON.stringify(input), limit)).toThrow();
  });
});
