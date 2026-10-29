import { describe, expect, it } from "vitest";
import { describeOriProposal, parseOriReviewableProposal } from "./oriProposalReview.js";
const move = {
  schemaVersion: "ori/proposal/v0",
  operation: "append",
  requiresLearnerApproval: true,
  blocks: [{ kind: "move", steps: 2 }],
};
describe("Ori browser proposal boundary", () => {
  it("describes only validated proposal blocks", () => {
    const parsed = parseOriReviewableProposal(move);
    expect(parsed).not.toBeNull();
    expect(describeOriProposal(parsed!)).toContain("2 paso");
  });
  it("rejects unexpected or executable fields", () => {
    expect(parseOriReviewableProposal({ ...move, shell: "rm" })).toBeNull();
    expect(
      parseOriReviewableProposal({
        ...move,
        blocks: [{ kind: "move", steps: 2, code: "private" }],
      }),
    ).toBeNull();
  });
  it("rejects invalid or multi-block proposals", () => {
    expect(
      parseOriReviewableProposal({ ...move, blocks: [{ kind: "move", steps: 99 }] }),
    ).toBeNull();
    expect(
      parseOriReviewableProposal({
        ...move,
        blocks: [
          { kind: "move", steps: 1 },
          { kind: "turn", direction: "left" },
        ],
      }),
    ).toBeNull();
  });
});
