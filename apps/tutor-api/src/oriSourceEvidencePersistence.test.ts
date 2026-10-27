import { describe, expect, it } from "vitest";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriSqliteEvidenceArtifactRepository } from "./oriSqliteEvidenceArtifactRepository.js";
import { createOriSourceEvidencePersistence } from "./oriSourceEvidencePersistence.js";
import type { OriMig03ReviewHandoff } from "./oriMig03ReviewHandoff.js";

const matrix = {
  total: 1,
  available: 1,
  missing: 0,
  divergent: 0,
  rows: [
    {
      missionId: "move",
      missionIndex: 0,
      status: "matched-observables" as const,
      matches: 4,
      divergences: 0,
      notComparable: 0,
    },
  ],
};
const handoff: OriMig03ReviewHandoff = {
  schemaVersion: "agorix/ori-mig03-review-handoff/v1",
  missionCount: 1,
  selectedForReview: 1,
  pendingEvidence: [
    {
      missionId: "move",
      status: "awaiting-human-review",
      requiredEvidence: [
        "ori-proposal",
        "kids-baseline",
        "learning-context",
        "learner-facing-explanation",
        "educator-rationale",
      ],
    },
  ],
  deferredMissionIds: [],
  unresolvedMissionIds: [],
  nextAction: "educator-review-required",
  formalApproval: false,
  rolloutAuthorized: false,
};
const captured = {
  missionId: "move",
  missionIndex: 0,
  oriProposal: { action: "hint" },
  kidsBaseline: { action: "hint" },
  provenance: "ori-loopback-synthetic-mission" as const,
};
describe("MIG-03 source evidence to SQLite", () => {
  it("persists machine evidence but never human rationale", async () => {
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const artifacts = openOriSqliteEvidenceArtifactRepository(":memory:");
    reviews.publish("pilot", matrix);
    const digest = reviews.get("pilot")!.digest;
    const persist = createOriSourceEvidencePersistence(reviews, artifacts);
    const refs = persist.persist(handoff, "pilot", digest, captured, {
      learningContext: { stage: "explore" },
      learnerFacingExplanation: { text: "Try moving" },
    });
    expect(Object.keys(refs ?? {})).toHaveLength(4);
    expect(await artifacts.find("pilot", digest, "move", "educator-rationale")).toBeNull();
    artifacts.close();
    reviews.close();
  });
  it("rejects missing plans and absent host context", async () => {
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const artifacts = openOriSqliteEvidenceArtifactRepository(":memory:");
    reviews.publish("pilot", matrix);
    const digest = reviews.get("pilot")!.digest;
    const persist = createOriSourceEvidencePersistence(reviews, artifacts);
    expect(
      persist.persist(
        handoff,
        "pilot",
        digest,
        { ...captured, oriProposal: null },
        {
          learningContext: { stage: "explore" },
          learnerFacingExplanation: { text: "Try moving" },
        },
      ),
    ).toBeNull();
    expect(
      persist.persist(handoff, "pilot", digest, captured, {
        learningContext: null,
        learnerFacingExplanation: null,
      }),
    ).toBeNull();
    artifacts.close();
    reviews.close();
  });
  it("rejects cross-mission indices and evidence for missing candidates", async () => {
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const artifacts = openOriSqliteEvidenceArtifactRepository(":memory:");
    reviews.publish("pilot", matrix);
    const digest = reviews.get("pilot")!.digest;
    const persist = createOriSourceEvidencePersistence(reviews, artifacts);
    const host = {
      learningContext: { stage: "explore" },
      learnerFacingExplanation: { text: "Try moving" },
    };
    expect(
      persist.persist(handoff, "pilot", digest, { ...captured, missionIndex: 99 }, host),
    ).toBeNull();
    expect(await artifacts.find("pilot", digest, "move", "ori-proposal")).toBeNull();
    artifacts.close();
    reviews.close();
  });
});
