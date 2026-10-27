import { describe, expect, it } from "vitest";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriSqliteEvidenceArtifactRepository } from "./oriSqliteEvidenceArtifactRepository.js";
import { createOriMachineReviewEvidenceSource } from "./oriMachineReviewEvidenceSource.js";
import type { OriMig03ReviewHandoff } from "./oriMig03ReviewHandoff.js";

const matrix = {
  total: 1, available: 1, missing: 0, divergent: 0,
  rows: [{ missionId: "move", missionIndex: 0, status: "matched-observables" as const,
    matches: 4, divergences: 0, notComparable: 0 }],
};
const handoff: OriMig03ReviewHandoff = {
  schemaVersion: "agorix/ori-mig03-review-handoff/v1",
  missionCount: 1, selectedForReview: 1,
  pendingEvidence: [{ missionId: "move", status: "awaiting-human-review",
    requiredEvidence: ["ori-proposal", "kids-baseline", "learning-context",
      "learner-facing-explanation", "educator-rationale"] }],
  deferredMissionIds: [], unresolvedMissionIds: [],
  nextAction: "educator-review-required", formalApproval: false, rolloutAuthorized: false,
};
const machine = {
  oriProposal: { action: "hint" }, kidsBaseline: { action: "hint" },
  learningContext: { attempts: 2 }, learnerFacingExplanation: { text: "Try a move" },
};
describe("MIG-03 host machine evidence source", () => {
  it("stores four machine artifacts but never fabricates human rationale", async () => {
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const artifacts = openOriSqliteEvidenceArtifactRepository(":memory:");
    reviews.publish("pilot", matrix);
    const digest = reviews.get("pilot")!.digest;
    const refs = createOriMachineReviewEvidenceSource(reviews, artifacts)
      .captureMachineEvidence(handoff, "pilot", digest, "move", machine);
    expect(Object.keys(refs ?? {}).sort()).toEqual([
      "kids-baseline", "learner-facing-explanation", "learning-context", "ori-proposal",
    ]);
    expect(await artifacts.find("pilot", digest, "move", "educator-rationale")).toBeNull();
    artifacts.close(); reviews.close();
  });
  it("rejects missing or stale evidence without writing artifacts", async () => {
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const artifacts = openOriSqliteEvidenceArtifactRepository(":memory:");
    reviews.publish("pilot", matrix);
    const digest = reviews.get("pilot")!.digest;
    const source = createOriMachineReviewEvidenceSource(reviews, artifacts);
    expect(source.captureMachineEvidence(handoff, "pilot", "a".repeat(64), "move", machine))
      .toBeNull();
    expect(source.captureMachineEvidence(handoff, "pilot", digest, "move", {
      ...machine, oriProposal: null,
    })).toBeNull();
    expect(await artifacts.find("pilot", digest, "move", "ori-proposal")).toBeNull();
    artifacts.close(); reviews.close();
  });
});
