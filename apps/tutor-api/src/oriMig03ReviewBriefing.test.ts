import { describe, expect, it } from "vitest";
import { planOriPedagogicalReview } from "./oriPedagogicalReviewSampling.js";
import { buildOriAutomatedTriageReport } from "./oriAutomatedPedagogicalTriage.js";
import { buildOriReviewBriefing } from "./oriMig03ReviewBriefing.js";
import type { OriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";

const matrix: OriMissionDivergenceMatrix = {
  total: 3, available: 2, missing: 1, divergent: 1,
  rows: [
    { missionId: "missing", missionIndex: 0, status: "missing", matches: 0, divergences: 0, notComparable: 0 },
    { missionId: "different", missionIndex: 1, status: "divergent", matches: 1, divergences: 1, notComparable: 1 },
    { missionId: "match", missionIndex: 2, status: "matched-observables", matches: 4, divergences: 0, notComparable: 0 },
  ],
};
describe("MIG-03 human review briefing", () => {
  it("summarizes mandatory review cases and unresolved missions", () => {
    const plan = planOriPedagogicalReview(matrix, 0);
    const triage = buildOriAutomatedTriageReport(matrix, plan);
    expect(buildOriReviewBriefing(triage, plan)).toMatchObject({
      summary: { totalMissions: 3, selectedForReview: 2, deferred: 1, mandatory: 2,
        missing: 1, divergent: 1 },
      selectedMissionIds: ["missing", "different"],
      unresolvedMissionIds: ["missing", "different"],
      humanAcceptance: "pending",
      rolloutAuthorized: false,
    });
  });
  it("rejects inconsistent sampling and never approves matches", () => {
    const plan = planOriPedagogicalReview(matrix, 1);
    const triage = buildOriAutomatedTriageReport(matrix, plan);
    expect(() => buildOriReviewBriefing(triage, {
      ...plan, deferred: ["forged"],
    })).toThrow("inconsistent-review-briefing");
    expect(buildOriReviewBriefing(triage, plan).humanAcceptance).toBe("pending");
  });
});
