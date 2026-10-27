import { describe, expect, it } from "vitest";
import type { ProjectRepository } from "@agorix/project-repository";
import { createOriMig03HostEvidenceProbes } from "./oriMig03HostEvidenceProbes.js";
import { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriTicketReviewLineageStore } from "./oriTicketReviewLineage.js";

const ticketId = "123e4567-e89b-42d3-a456-426614174000";
const matrix = {
  total: 1, available: 1, missing: 0, divergent: 0,
  rows: [{ missionId: "move", missionIndex: 0, status: "matched-observables" as const,
    matches: 4, divergences: 0, notComparable: 0 }],
};
describe("MIG-03 concrete host evidence probes", () => {
  it("checks real repository ownership and durable review state", async () => {
    const presentations = openOriTicketPresentationSqliteStore(":memory:");
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const lineage = openOriTicketReviewLineageStore(":memory:");
    reviews.publish("pilot", matrix);
    const probes = createOriMig03HostEvidenceProbes({
      session: async () => ({ accountId: "student", sessionId: "session" }),
      repository: { get: async () => ({
        ownerId: "student", projectId: "project",
      }) } as unknown as ProjectRepository,
      projectId: "project", ticketId, reviewId: "pilot", presentations, reviews, lineage,
      resolveTicket: async () => ({
        id: ticketId, status: "pending", proposal: {}, appliedChanges: false,
      }),
      checkOriProcess: async () => false,
      humanReviewVerified: async () => false,
    });
    expect(await probes.session()).toBe(true);
    expect(await probes.project()).toBe(true);
    expect(await probes.durableStorage()).toBe(false);
    await presentations.record({ owner: "student", projectId: "project",
      ticketId, descriptionHash: "a".repeat(64) });
    expect(await probes.durableStorage()).toBe(false);
    const state = reviews.get("pilot")!;
    expect(lineage.bind({ owner: "student", projectId: "project", ticketId,
      reviewId: "pilot", digest: state.digest, revision: state.revision })).toBe(true);
    expect(await probes.durableStorage()).toBe(true);
    expect(await probes.oriProcess()).toBe(false);
    lineage.close(); presentations.close(); reviews.close();
  });
  it("fails closed for guests", async () => {
    const presentations = openOriTicketPresentationSqliteStore(":memory:");
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const lineage = openOriTicketReviewLineageStore(":memory:");
    const probes = createOriMig03HostEvidenceProbes({
      session: async () => null,
      repository: { get: async () => { throw Error("denied"); } } as unknown as ProjectRepository,
      projectId: "project", ticketId, reviewId: "pilot", presentations, reviews, lineage,
      resolveTicket: async () => null, checkOriProcess: async () => false,
      humanReviewVerified: async () => false,
    });
    expect(await probes.session()).toBe(false);
    expect(await probes.project()).toBe(false);
    expect(await probes.durableStorage()).toBe(false);
    lineage.close(); presentations.close(); reviews.close();
  });
});
