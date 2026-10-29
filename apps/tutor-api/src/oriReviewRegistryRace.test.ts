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
describe("Ori review decision race and expiry", () => {
  it("prevents two concurrent decisions from overwriting each other", async () => {
    let release: (value: string) => void = () => {};
    const pending = new Promise<string>((resolve) => {
      release = resolve;
    });
    const registry = createOriReviewRegistry({ currentRevision: async () => pending });
    const ticket = registry.issue(response, "session-a", "project-a")!;
    const first = registry.decide(ticket.id, "session-a", "project-a", "accept");
    const second = await registry.decide(ticket.id, "session-a", "project-a", "reject");
    expect(second?.status).toBe("pending");
    release(revision);
    expect((await first)?.status).toBe("accepted");
    expect(registry.read(ticket.id, "session-a", "project-a")?.status).toBe("accepted");
  });
  it("does not finalize a decision after the ticket expires during await", async () => {
    let clock = 0;
    let release: (value: string) => void = () => {};
    const pending = new Promise<string>((resolve) => {
      release = resolve;
    });
    const registry = createOriReviewRegistry({
      now: () => clock,
      ttlMs: 10,
      currentRevision: async () => pending,
    });
    const ticket = registry.issue(response, "session-a", "project-a")!;
    const decision = registry.decide(ticket.id, "session-a", "project-a", "accept");
    clock = 11;
    release(revision);
    expect(await decision).toBeNull();
    expect(registry.read(ticket.id, "session-a", "project-a")).toBeNull();
  });
  it("releases the lock after a failed trusted revision lookup", async () => {
    let calls = 0;
    const registry = createOriReviewRegistry({
      currentRevision: async () => {
        calls++;
        if (calls === 1) throw Error("temporary failure");
        return revision;
      },
    });
    const ticket = registry.issue(response, "session-a", "project-a")!;
    await expect(registry.decide(ticket.id, "session-a", "project-a", "accept")).rejects.toThrow();
    expect((await registry.decide(ticket.id, "session-a", "project-a", "reject"))?.status).toBe(
      "rejected",
    );
  });
});
