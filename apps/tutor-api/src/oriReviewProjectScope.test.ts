import { describe, expect, it } from "vitest";
import { createOriReviewRegistry } from "./oriReviewRegistry.js";
import type { OriHostEvidenceResult } from "./oriHostEvidenceAdapter.js";
const revision = "a".repeat(64);
const response: OriHostEvidenceResult = {
  status: "ready",
  requiresLearnerApproval: true,
  appliedChanges: false,
  proposal: {
    schemaVersion: "ori/proposal/v0",
    operation: "append",
    requiresLearnerApproval: true,
    blocks: [{ kind: "move", steps: 1 }],
  },
  evidenceReceipt: { programRevision: revision, digest: "b".repeat(64), complete: true },
};
describe("Ori project-scoped proposal tickets", () => {
  it("rejects access from another project even for the same owner", async () => {
    const registry = createOriReviewRegistry({ currentRevision: async () => revision });
    const ticket = registry.issue(response, "learner-a", "project-a")!;
    expect(registry.read(ticket.id, "learner-a", "project-b")).toBeNull();
    expect(await registry.decide(ticket.id, "learner-a", "project-b", "accept")).toBeNull();
    expect(registry.read(ticket.id, "learner-a", "project-a")?.status).toBe("pending");
    expect((await registry.decide(ticket.id, "learner-a", "project-a", "reject"))?.status).toBe(
      "rejected",
    );
  });
  it("rejects missing or oversized project identifiers", () => {
    const registry = createOriReviewRegistry({ currentRevision: async () => revision });
    expect(registry.issue(response, "learner-a", "")).toBeNull();
    expect(registry.issue(response, "learner-a", "x".repeat(129))).toBeNull();
  });
});
