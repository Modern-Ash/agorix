import { describe, expect, it } from "vitest";
import { validateOriEducatorSubmissions } from "./oriEducatorSubmissionValidation.js";
import type { OriMig03ReviewHandoff } from "./oriMig03ReviewHandoff.js";

const handoff: OriMig03ReviewHandoff = {
  schemaVersion: "agorix/ori-mig03-review-handoff/v1",
  missionCount: 1, selectedForReview: 1,
  pendingEvidence: [{ missionId: "move", status: "awaiting-human-review",
    requiredEvidence: ["ori-proposal", "kids-baseline", "educator-rationale"] }],
  deferredMissionIds: [], unresolvedMissionIds: [],
  nextAction: "educator-review-required", formalApproval: false, rolloutAuthorized: false,
};
const submission = {
  missionId: "move", reviewerId: "educator-1", disposition: "approve" as const,
  rationale: "La propuesta mantiene el control del alumno.",
  evidenceRefs: { "ori-proposal": "artifact:ori", "kids-baseline": "artifact:kids",
    "educator-rationale": "artifact:reason" },
};
describe("MIG-03 educator submission completeness", () => {
  it("accepts complete human-provided evidence without authorizing rollout", () => {
    expect(validateOriEducatorSubmissions(handoff, [submission])).toEqual({
      status: "complete-for-recording", blockers: [], reviewed: 1, required: 1,
      rolloutAuthorized: false,
    });
  });
  it("blocks missing references, duplicates, rejection and deferred missions", () => {
    expect(validateOriEducatorSubmissions(handoff, [{
      ...submission, evidenceRefs: { "ori-proposal": "artifact:ori" },
    }]).blockers).toContain("missing-required-evidence");
    expect(validateOriEducatorSubmissions(handoff, [submission, submission]).status).toBe("blocked");
    expect(validateOriEducatorSubmissions(handoff, [{
      ...submission, disposition: "reject",
    }]).blockers).toContain("educator-rejection");
    expect(validateOriEducatorSubmissions({
      ...handoff, deferredMissionIds: ["later"],
    }, [submission]).blockers).toContain("review-coverage-incomplete");
  });
});
