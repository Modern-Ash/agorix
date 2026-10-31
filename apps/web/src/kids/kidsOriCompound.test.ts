import { describe, expect, it } from "vitest";
import { acceptProposal, rejectProposal } from "@agorix/proposals";
import { createStudioProgram } from "./kidsStudioModel.js";
import { explainOriCompound, proposeOriCompound, reviewOriCompound } from "./kidsOriCompound.js";

const actorId = "actor:studio-1-nova";

describe("Ori's closed compound condition idea", () => {
  it("keeps the program unchanged until the child accepts a reviewed AND proposal", () => {
    const program = createStudioProgram("nova");
    const proposal = proposeOriCompound(program, actorId, "and", "es");
    const review = reviewOriCompound(program, actorId, proposal);
    expect(program.scripts[0]?.statements).toEqual([]);
    expect(review.candidateProgram.scripts[0]?.statements[0]).toMatchObject({
      type: "if",
      condition: { type: "and", left: { type: "keyDown" }, right: { type: "touchingStageEdge" } },
    });
    expect(rejectProposal(program, review).program).toEqual(program);
    expect(acceptProposal(program, review).program.scripts[0]?.statements).toHaveLength(1);
    expect(explainOriCompound("and", "es")).toContain("solo si");
  });

  it("rejects another actor, forged condition and a stale program", () => {
    const program = createStudioProgram("nova");
    const proposal = proposeOriCompound(program, actorId, "or", "es");
    expect(() => reviewOriCompound(program, "actor:studio-2-mika", proposal)).toThrow();
    const forged = {
      ...proposal,
      operations: [
        {
          type: "appendStatement" as const,
          scriptIndex: 0,
          statement: { type: "move" as const, steps: 40 },
        },
      ],
    };
    expect(() => reviewOriCompound(program, actorId, forged)).toThrow();
    const changed = acceptProposal(program, reviewOriCompound(program, actorId, proposal)).program;
    expect(() => reviewOriCompound(changed, actorId, proposal)).toThrow();
  });
});
