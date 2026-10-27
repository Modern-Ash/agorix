import { describe, expect, it } from "vitest";
import { createOriEducatorReviewWorkflow } from "./oriEducatorReviewWorkflow.js";
import type { OriMissionDivergenceMatrix } from "./oriMissionDivergenceMatrix.js";

const matrix: OriMissionDivergenceMatrix = {
  total: 2, available: 2, missing: 0, divergent: 1,
  rows: [
    { missionId: "a", missionIndex: 0, status: "divergent", matches: 1, divergences: 1, notComparable: 2 },
    { missionId: "b", missionIndex: 1, status: "partial-match", matches: 2, divergences: 0, notComparable: 2 },
  ],
};
const reviewer = { id: "verified-educator", canReviewOri: true };
const decision = { missionId: "a", decision: "approve" as const, rationale: "Revisión pedagógica documentada" };

describe("MIG-03 trusted educator review workflow", () => {
  it("requires verified authority and rejects stale revisions", () => {
    const workflow = createOriEducatorReviewWorkflow(matrix);
    const { evidenceDigest, revision } = workflow.snapshot();
    expect(workflow.submit(null, evidenceDigest, revision, decision)).toBe("unauthorized");
    expect(workflow.submit({ id: "guest", canReviewOri: false }, evidenceDigest, revision, decision))
      .toBe("unauthorized");
    expect(workflow.submit(reviewer, evidenceDigest, revision, decision)).toBe("recorded");
    expect(workflow.submit(reviewer, evidenceDigest, revision, decision)).toBe("conflict");
    expect(workflow.snapshot().reviewed).toBe(1);
    expect(workflow.audit()).toHaveLength(1);
    expect(workflow.audit()[0]?.reviewerId).toBe(reviewer.id);
  });
  it("blocks duplicate mission decisions and never authorizes rollout", () => {
    const workflow = createOriEducatorReviewWorkflow(matrix);
    const first = workflow.snapshot();
    expect(workflow.submit(reviewer, first.evidenceDigest, first.revision, decision)).toBe("recorded");
    const second = workflow.snapshot();
    expect(workflow.submit(reviewer, second.evidenceDigest, second.revision, decision)).toBe("invalid");
    expect(workflow.submit(reviewer, second.evidenceDigest, second.revision, {
      missionId: "b", decision: "approve", rationale: "Control de aprendiz verificado",
    })).toBe("recorded");
    expect(workflow.snapshot()).toMatchObject({
      status: "approved", reviewed: 2, required: 2, rolloutAuthorized: false,
    });
  });
  it("invalidates all decisions when the underlying evidence changes", () => {
    const workflow = createOriEducatorReviewWorkflow(matrix);
    const old = workflow.snapshot();
    expect(workflow.submit(reviewer, old.evidenceDigest, old.revision, decision)).toBe("recorded");
    expect(workflow.replaceEvidence({ ...matrix, divergent: 0, rows: [
      { ...matrix.rows[0]!, status: "partial-match", divergences: 0 },
      matrix.rows[1]!,
    ] })).toBe(true);
    const current = workflow.snapshot();
    expect(current.evidenceDigest).not.toBe(old.evidenceDigest);
    expect(current.reviewed).toBe(0);
    expect(current.status).toBe("pending");
    expect(workflow.audit()).toHaveLength(0);
    expect(workflow.submit(reviewer, old.evidenceDigest, old.revision, decision)).toBe("conflict");
  });
  it("rejects fabricated missions and inadequate rationale", () => {
    const workflow = createOriEducatorReviewWorkflow(matrix);
    const { evidenceDigest, revision } = workflow.snapshot();
    expect(workflow.submit(reviewer, evidenceDigest, revision, { ...decision, missionId: "fake" }))
      .toBe("invalid");
    expect(workflow.submit(reviewer, evidenceDigest, revision, { ...decision, rationale: "ok" }))
      .toBe("invalid");
  });
});
