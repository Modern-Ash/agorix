import { describe, expect, it } from "vitest";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriSqliteEvidenceArtifactRepository } from "./oriSqliteEvidenceArtifactRepository.js";
import { openOriTicketReviewLineageStore } from "./oriTicketReviewLineage.js";
import { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";
import { createOriSemanticEvidenceGate } from "./oriSemanticEvidenceGate.js";
import type { OriReviewTicket } from "./oriReviewRegistry.js";

const id = "123e4567-e89b-42d3-a456-426614174000";
const proposal = {
  schemaVersion: "ori/proposal/v0",
  operation: "append",
  requiresLearnerApproval: true,
  blocks: [{ kind: "move", steps: 1 }],
};
const ticket: OriReviewTicket = {
  id,
  status: "pending",
  appliedChanges: false,
  proposal,
};
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
describe("MIG-03 ticket-to-mission semantic evidence", () => {
  it("requires a matching immutable Ori proposal artifact before human review", async () => {
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const artifacts = openOriSqliteEvidenceArtifactRepository(":memory:");
    const lineage = openOriTicketReviewLineageStore(":memory:");
    const presentations = openOriTicketPresentationSqliteStore(":memory:");
    reviews.publish("pilot", matrix);
    const state = reviews.get("pilot")!;
    lineage.bind({
      owner: "student",
      projectId: "project",
      ticketId: id,
      reviewId: "pilot",
      digest: state.digest,
      revision: state.revision,
    });
    await presentations.record({
      owner: "student",
      projectId: "project",
      ticketId: id,
      descriptionHash: "a".repeat(64),
    });
    const gate = createOriSemanticEvidenceGate({
      reviews,
      artifacts,
      lineage,
      presentations,
      resolveTicket: async () => ticket,
    });
    expect((await gate.assess("student", "project", id, "pilot", "move")).status).toBe("blocked");
    artifacts.put(
      "pilot",
      state.digest,
      "move",
      "ori-proposal",
      Buffer.from(JSON.stringify(proposal)),
    );
    expect((await gate.assess("student", "project", id, "pilot", "move")).status).toBe(
      "ready-for-human-review",
    );
    const unknown = await gate.assess("student", "project", id, "pilot", "other");
    expect(unknown.status).toBe("blocked");
    expect(unknown.blockers).toContain("mission-not-in-review");
    artifacts.close();
    lineage.close();
    presentations.close();
    reviews.close();
  });
});
