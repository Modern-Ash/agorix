import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { ProjectRepository } from "@agorix/project-repository";
import { createOriMig03HostExitComposition } from "./oriMig03HostExitComposition.js";
import { openOriAtomicEducatorReviewStore } from "./oriAtomicEducatorReviewStore.js";
import { openOriTicketReviewLineageStore } from "./oriTicketReviewLineage.js";
import { openOriTicketPresentationSqliteStore } from "./oriTicketPresentationSqliteStore.js";
import type { createOriMig03EducatorAuditBundle } from "./oriMig03EducatorAuditBundle.js";

type Bundle = Awaited<ReturnType<ReturnType<typeof createOriMig03EducatorAuditBundle>["build"]>>;
const id = "123e4567-e89b-42d3-a456-426614174000";
function bundle(): Bundle {
  const payload = {
    schema: "agorix/ori-mig03-educator-audit/v1" as const,
    reviewId: "pilot",
    missionId: "move",
    ticketId: id,
    reviewDigest: "a".repeat(64),
    reviewRevision: 1,
    proposalEvidenceHash: "b".repeat(64),
    presentationHash: "c".repeat(64),
    technicalReadiness: "blocked" as const,
    blockers: ["review-required"],
    humanApproval: false as const,
    rolloutAuthorized: false as const,
  };
  return {
    ...payload,
    auditHash: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
  };
}
describe("MIG-03 host exit composition", () => {
  it("executes concrete host checks and reports missing evidence", async () => {
    const reviews = openOriAtomicEducatorReviewStore(":memory:");
    const lineage = openOriTicketReviewLineageStore(":memory:");
    const presentations = openOriTicketPresentationSqliteStore(":memory:");
    const composition = createOriMig03HostExitComposition({
      session: async () => ({ accountId: "student", sessionId: "session" }),
      repository: {
        get: async () => ({
          ownerId: "student",
          projectId: "project",
        }),
      } as unknown as ProjectRepository,
      projectId: "project",
      ticketId: id,
      reviewId: "pilot",
      presentations,
      reviews,
      lineage,
      resolveTicket: async () => null,
      checkOriProcess: async () => false,
      humanReviewVerified: async () => false,
    });
    const report = await composition.assess(bundle());
    expect(report?.status).toBe("blocked");
    expect(report?.blockers).toContain("durable-storage-unverified");
    expect(report?.blockers).toContain("real-ori-process-unverified");
    expect(report?.rolloutAuthorized).toBe(false);
    lineage.close();
    presentations.close();
    reviews.close();
  });
});
