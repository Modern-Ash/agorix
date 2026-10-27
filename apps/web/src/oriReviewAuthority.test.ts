import { describe, expect, it } from "vitest";
import { parseOriIssuedProposal } from "./oriProposalIssuanceClient.js";
import { parseOriServerDecision } from "./oriServerDecision.js";
const issued = {
  ticketId: "123e4567-e89b-42d3-a456-426614174000",
  proposal: {
    schemaVersion: "ori/proposal/v0",
    operation: "append",
    requiresLearnerApproval: true,
    blocks: [{ kind: "move", steps: 1 }],
  },
  appliedChanges: false,
};
describe("Ori learner review authority separation", () => {
  it("requires server-issued ticket but not browser-invented revision", () => {
    const value = parseOriIssuedProposal(issued);
    expect(value?.ticketId).toBe(issued.ticketId);
    expect(value).not.toHaveProperty("revision");
  });
  it("recognizes server stale status as authoritative", () => {
    expect(parseOriServerDecision({ status: "stale", appliedChanges: false })).toBe("stale");
    expect(parseOriServerDecision({ status: "accepted", appliedChanges: true })).toBe(
      "unavailable",
    );
  });
});
