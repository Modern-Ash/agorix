import { describe, expect, it } from "vitest";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriTicketReviewLineageStore } from "./oriTicketReviewLineage.js";
import { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";
import { createOriAuthoritativeLineageService } from "./oriAuthoritativeLineageService.js";
import type { OriReviewTicket } from "./oriReviewRegistry.js";

const ticketId = "123e4567-e89b-42d3-a456-426614174000";
const ticket: OriReviewTicket = {
  id: ticketId,
  status: "pending",
  appliedChanges: false,
  proposal: {
    schemaVersion: "ori/proposal/v0",
    operation: "append",
    requiresLearnerApproval: true,
    blocks: [{ kind: "move", steps: 1 }],
  },
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
describe("MIG-03 authoritative ticket lineage bundle", () => {
  it("binds server-owned ticket and requires presentation before human review", async () => {
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const lineage = openOriTicketReviewLineageStore(":memory:");
    const presentations = openOriTicketPresentationSqliteStore(":memory:");
    reviews.publish("pilot", matrix);
    const service = createOriAuthoritativeLineageService({
      reviews,
      lineage,
      presentations,
      resolveTicket: async () => ticket,
    });
    expect(await service.bindIssuedTicket("student", "project", ticketId, "pilot")).toBe(true);
    expect((await service.assess("student", "project", ticketId, "pilot")).status).toBe("blocked");
    await presentations.record({
      owner: "student",
      projectId: "project",
      ticketId,
      descriptionHash: "a".repeat(64),
    });
    expect(await service.assess("student", "project", ticketId, "pilot")).toEqual({
      status: "ready-for-human-review",
      blockers: [],
      rolloutAuthorized: false,
    });
    lineage.close();
    reviews.close();
    presentations.close();
  });
  it("rejects unknown tickets without binding", async () => {
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const lineage = openOriTicketReviewLineageStore(":memory:");
    const presentations = openOriTicketPresentationSqliteStore(":memory:");
    reviews.publish("pilot", matrix);
    const service = createOriAuthoritativeLineageService({
      reviews,
      lineage,
      presentations,
      resolveTicket: async () => null,
    });
    expect(await service.bindIssuedTicket("student", "project", ticketId, "pilot")).toBe(false);
    expect((await service.assess("student", "project", ticketId, "pilot")).status).toBe("blocked");
    lineage.close();
    reviews.close();
    presentations.close();
  });
});
