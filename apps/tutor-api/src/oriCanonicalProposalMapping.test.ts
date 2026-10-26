import { describe, expect, it } from "vitest";
import { mapOriProposalToCanonicalStatement } from "./oriCanonicalProposalMapping.js";

const proposal = (block: unknown) => ({
  schemaVersion: "ori/proposal/v0",
  operation: "append",
  requiresLearnerApproval: true,
  blocks: [block],
});

describe("Ori v0 to Agorix canonical statement", () => {
  it("maps an allowed move without mutating the proposal", () => {
    const input = proposal({ kind: "move", steps: 3 });
    expect(mapOriProposalToCanonicalStatement(input, ["move"])).toEqual({
      type: "move",
      steps: 3,
    });
    expect(input.blocks).toEqual([{ kind: "move", steps: 3 }]);
  });

  it("maps relative quarter turns into signed canonical degrees", () => {
    expect(mapOriProposalToCanonicalStatement(proposal({ kind: "turn", direction: "left" }), ["turn"]))
      .toEqual({ type: "turn", degrees: -90 });
    expect(mapOriProposalToCanonicalStatement(proposal({ kind: "turn", direction: "right" }), ["turn"]))
      .toEqual({ type: "turn", degrees: 90 });
  });

  it.each([
    proposal({ kind: "move", steps: 0 }),
    proposal({ kind: "move", steps: 6 }),
    proposal({ kind: "move", steps: 1.5 }),
    proposal({ kind: "move", steps: 1, extra: true }),
    proposal({ kind: "turn", direction: "up" }),
    proposal({ kind: "repeat", times: 3 }),
    { ...proposal({ kind: "move", steps: 1 }), requiresLearnerApproval: false },
    { ...proposal({ kind: "move", steps: 1 }), operation: "replace" },
    { ...proposal({ kind: "move", steps: 1 }), blocks: [] },
    { ...proposal({ kind: "move", steps: 1 }), unexpected: true },
  ])("fails closed for invalid or unsupported proposals", (input) => {
    expect(mapOriProposalToCanonicalStatement(input, ["move", "turn"])).toBeNull();
  });

  it("enforces the host allowlist and never applies a project mutation", () => {
    expect(mapOriProposalToCanonicalStatement(proposal({ kind: "move", steps: 2 }), [])).toBeNull();
    expect(mapOriProposalToCanonicalStatement(proposal({ kind: "turn", direction: "left" }), ["move"]))
      .toBeNull();
  });
});
