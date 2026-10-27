import { describe, expect, it } from "vitest";
import { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { createOriMig03PresentationReadiness } from "./oriMig03PresentationReadiness.js";
import type { OriReviewTicket } from "./oriReviewRegistry.js";

const id = "123e4567-e89b-42d3-a456-426614174000";
const ticket: OriReviewTicket = {
  id, status: "pending", appliedChanges: false,
  proposal: { schemaVersion: "ori/proposal/v0", operation: "append",
    requiresLearnerApproval: true, blocks: [{ kind: "move", steps: 1 }] },
};
const matrix = {
  total: 1, available: 1, missing: 0, divergent: 0,
  rows: [{ missionId: "move", missionIndex: 0, status: "matched-observables" as const,
    matches: 4, divergences: 0, notComparable: 0 }],
};
describe("MIG-03 bundled presentation readiness", () => {
  it("requires real stored ticket acknowledgement and review before human assessment", async () => {
    const tickets = openOriTicketPresentationSqliteStore(":memory:");
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    reviews.publish("pilot", matrix);
    const gate = createOriMig03PresentationReadiness({
      tickets, reviews, resolveTicket: async () => ticket,
    });
    expect((await gate.assess("student", "project", id, "pilot")).status).toBe("blocked");
    await tickets.record({ owner: "student", projectId: "project",
      ticketId: id, descriptionHash: "a".repeat(64) });
    expect(await gate.assess("student", "project", id, "pilot")).toEqual({
      status: "ready-for-human-review", blockers: [], rolloutAuthorized: false,
    });
    tickets.close(); reviews.close();
  });
  it("blocks missing technical evidence and unknown tickets", async () => {
    const tickets = openOriTicketPresentationSqliteStore(":memory:");
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    reviews.publish("pilot", { ...matrix, missing: 1, available: 0,
      rows: [{ ...matrix.rows[0]!, status: "missing" as const }] });
    const gate = createOriMig03PresentationReadiness({
      tickets, reviews, resolveTicket: async () => null,
    });
    const result = await gate.assess("student", "project", id, "pilot");
    expect(result.blockers).toContain("ticket-unavailable");
    expect(result.blockers).toContain("technical-evidence-incomplete");
    tickets.close(); reviews.close();
  });
});
