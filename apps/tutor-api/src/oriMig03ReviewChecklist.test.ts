import { describe, expect, it } from "vitest";
import { buildOriPedagogicalReviewCorpus } from "./oriPedagogicalReviewCorpus.js";
import { planOriPedagogicalReview } from "./oriPedagogicalReviewSampling.js";
import { buildOriAutomatedTriageReport } from "./oriAutomatedPedagogicalTriage.js";
import { buildOriReviewBriefing } from "./oriMig03ReviewBriefing.js";
import { buildOriReviewChecklist } from "./oriMig03ReviewChecklist.js";
import type { OriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";

const matrix: OriMissionDivergenceMatrix = {
  total: 2, available: 1, missing: 1, divergent: 0,
  rows: [
    { missionId: "missing", missionIndex: 0, status: "missing", matches: 0, divergences: 0, notComparable: 0 },
    { missionId: "match", missionIndex: 1, status: "matched-observables", matches: 4, divergences: 0, notComparable: 0 },
  ],
};
describe("MIG-03 human evidence checklist", () => {
  it("requires supporting evidence for every selected mission", () => {
    const corpus = buildOriPedagogicalReviewCorpus(matrix);
    const plan = planOriPedagogicalReview(matrix, 0);
    const briefing = buildOriReviewBriefing(buildOriAutomatedTriageReport(matrix, plan), plan);
    const checklist = buildOriReviewChecklist(briefing, corpus);
    expect(checklist.items.map((item) => item.missionId)).toEqual(["missing"]);
    expect(checklist.items[0]?.requiredEvidence).toContain("educator-rationale");
    expect(checklist.deferredMissionIds).toEqual(["match"]);
    expect(checklist.formalApproval).toBe(false);
    expect(checklist.rolloutAuthorized).toBe(false);
  });
  it("rejects missing corpus coverage", () => {
    const corpus = buildOriPedagogicalReviewCorpus(matrix);
    const plan = planOriPedagogicalReview(matrix, 0);
    const briefing = buildOriReviewBriefing(buildOriAutomatedTriageReport(matrix, plan), plan);
    expect(() => buildOriReviewChecklist(briefing, corpus.slice(0, 1)))
      .toThrow("inconsistent-review-checklist");
  });
});
