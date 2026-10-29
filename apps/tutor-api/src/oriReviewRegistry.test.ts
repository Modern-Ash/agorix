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
describe("server-owned Ori proposal tickets", () => {
  it("issues opaque IDs and never applies changes", async () => {
    const registry = createOriReviewRegistry({ currentRevision: async () => revision });
    const ticket = registry.issue(response, "session-a", "project-a")!;
    expect(ticket.id).toMatch(/^[a-f0-9-]{36}$/);
    expect(ticket.status).toBe("pending");
    expect((await registry.decide(ticket.id, "session-a", "project-a", "accept"))?.status).toBe(
      "accepted",
    );
    expect((await registry.decide(ticket.id, "session-a", "project-a", "reject"))?.status).toBe(
      "accepted",
    );
    expect(registry.read(ticket.id, "session-a", "project-a")?.appliedChanges).toBe(false);
  });
  it("blocks stale revisions based on trusted callback", async () => {
    const registry = createOriReviewRegistry({ currentRevision: async () => "c".repeat(64) });
    const ticket = registry.issue(response, "session-a", "project-a")!;
    expect((await registry.decide(ticket.id, "session-a", "project-a", "accept"))?.status).toBe(
      "stale",
    );
  });
  it("expires tickets and caps memory", () => {
    let clock = 0;
    const registry = createOriReviewRegistry({
      now: () => clock,
      ttlMs: 10,
      maxSessions: 1,
      currentRevision: async () => revision,
    });
    const ticket = registry.issue(response, "session-a", "project-a")!;
    expect(registry.issue(response, "session-a", "project-a")).toBeNull();
    clock = 10;
    expect(registry.read(ticket.id, "session-a", "project-a")).toBeNull();
    expect(registry.issue(response, "session-a", "project-a")).not.toBeNull();
  });
  it("rejects missing proposals", () => {
    const registry = createOriReviewRegistry({ currentRevision: async () => revision });
    expect(registry.issue({ ...response, proposal: null }, "session-a", "project-a")).toBeNull();
  });
});
