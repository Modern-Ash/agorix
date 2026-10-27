import { describe, expect, it } from "vitest";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriSqliteEvidenceArtifactRepository } from "./oriSqliteEvidenceArtifactRepository.js";
import { openOriTicketReviewLineageStore } from "./oriTicketReviewLineage.js";
import { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";
import { createOriMig03EducatorAuditBundle } from "./oriMig03EducatorAuditBundle.js";

const id = "123e4567-e89b-42d3-a456-426614174000";
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
describe("MIG-03 educator audit bundle", () => {
  it("exports a deterministic blocked bundle without human approval", async () => {
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const artifacts = openOriSqliteEvidenceArtifactRepository(":memory:");
    const lineage = openOriTicketReviewLineageStore(":memory:");
    const presentations = openOriTicketPresentationSqliteStore(":memory:");
    reviews.publish("pilot", matrix);
    const bundle = createOriMig03EducatorAuditBundle({
      reviews,
      artifacts,
      lineage,
      presentations,
      resolveTicket: async () => null,
    });
    const first = await bundle.build("student", "project", id, "pilot", "move");
    const second = await bundle.build("student", "project", id, "pilot", "move");
    expect(first).toEqual(second);
    expect(first.auditHash).toMatch(/^[a-f0-9]{64}$/);
    expect(first.technicalReadiness).toBe("blocked");
    expect(first.humanApproval).toBe(false);
    expect(first.rolloutAuthorized).toBe(false);
    expect(first.blockers.length).toBeGreaterThan(0);
    lineage.close();
    artifacts.close();
    presentations.close();
    reviews.close();
  });
});
