import { describe, expect, it } from "vitest";
import { buildOriPedagogicalReviewCorpus } from "./oriPedagogicalReviewCorpus.js";
import { planOriPedagogicalReview } from "./oriPedagogicalReviewSampling.js";
import { buildOriAutomatedTriageReport } from "./oriAutomatedPedagogicalTriage.js";
import { buildOriReviewBriefing } from "./oriMig03ReviewBriefing.js";
import { buildOriReviewChecklist } from "./oriMig03ReviewChecklist.js";
import { buildOriMig03ReviewHandoff } from "./oriMig03ReviewHandoff.js";
import type { OriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";

const matrix: OriMissionDivergenceMatrix = {
  total: 2,
  available: 1,
  missing: 1,
  divergent: 0,
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
      missionId: "match",
      missionIndex: 1,
      status: "matched-observables",
      matches: 4,
      divergences: 0,
      notComparable: 0,
    },
  ],
};
describe("MIG-03 educator handoff package", () => {
  it("retains all selected and deferred missions without approval", () => {
    const corpus = buildOriPedagogicalReviewCorpus(matrix);
    const plan = planOriPedagogicalReview(matrix, 0);
    const briefing = buildOriReviewBriefing(buildOriAutomatedTriageReport(matrix, plan), plan);
    const checklist = buildOriReviewChecklist(briefing, corpus);
    expect(buildOriMig03ReviewHandoff(briefing, checklist)).toMatchObject({
      missionCount: 2,
      selectedForReview: 1,
      pendingEvidence: [{ missionId: "missing", status: "awaiting-human-review" }],
      deferredMissionIds: ["match"],
      nextAction: "educator-review-required",
      formalApproval: false,
      rolloutAuthorized: false,
    });
  });
  it("rejects inconsistent handoff coverage", () => {
    const corpus = buildOriPedagogicalReviewCorpus(matrix);
    const plan = planOriPedagogicalReview(matrix, 0);
    const briefing = buildOriReviewBriefing(buildOriAutomatedTriageReport(matrix, plan), plan);
    const checklist = buildOriReviewChecklist(briefing, corpus);
    expect(() =>
      buildOriMig03ReviewHandoff(briefing, {
        ...checklist,
        deferredMissionIds: ["missing"],
      }),
    ).toThrow("inconsistent-review-handoff");
  });
});
