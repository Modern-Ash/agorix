import { describe, expect, it } from "vitest";
import { getKidsMission, kidsMoveSteps } from "@agorix/curriculum";
import { acceptProposal, createProposalReview } from "@agorix/proposals";
import { createLearningCompanionRequest } from "@agorix/tutor-contract";
import { createKidsEditor, playKidsProgram } from "./kidsEditorModel.js";
import { computeKidsOri, createKidsOriProviderRuntime } from "./kidsOri.js";

const first = getKidsMission("kids.m1.straight", "es");

function withStatements(
  mission: typeof first,
  statements: (typeof first.starterProject.scripts)[number]["statements"],
) {
  return {
    ...mission.starterProject,
    scripts: [{ ...mission.starterProject.scripts[0]!, statements }],
  };
}

describe("Kids deterministic Ori provider (issue #379)", () => {
  it("offers the missing movement as a validated ProgramProposal without changing the program", () => {
    const program = createKidsEditor(first).current;
    const offer = computeKidsOri(program, first, 0);
    expect(offer.kind).toBe("move");
    if (!offer.proposal) throw new Error("missing proposal");
    const review = createProposalReview(program, offer.proposal);
    expect(program.scripts[0]?.statements).toEqual([]);
    expect(review.candidateProgram.scripts[0]?.statements).toEqual([
      { type: "move", steps: kidsMoveSteps(4) },
    ]);
    expect(
      playKidsProgram({ ...createKidsEditor(first), current: review.candidateProgram }, first)
        .evaluation.outcome,
    ).toBe("success");
  });

  it("offers a turn when the goal is outside the current heading", () => {
    const mission = getKidsMission("kids.m2.corner", "es");
    const program = withStatements(mission, [{ type: "move", steps: kidsMoveSteps(3) }]);
    const offer = computeKidsOri(program, mission, 1);
    expect(offer.kind).toBe("turn");
    if (!offer.proposal) throw new Error("missing proposal");
    expect(
      createProposalReview(program, offer.proposal).candidateProgram.scripts[0]?.statements.at(-1),
    ).toEqual({ type: "turn", degrees: -90 });
  });

  it("uses Repeat for three aligned cells on mission 3", () => {
    const mission = getKidsMission("kids.m3.zigzag", "es");
    const offer = computeKidsOri(mission.starterProject, mission, 2);
    expect(offer.kind).toBe("repeat");
    if (!offer.proposal) throw new Error("missing proposal");
    expect(
      createProposalReview(
        mission.starterProject,
        offer.proposal,
      ).candidateProgram.scripts[0]?.statements.at(-1),
    ).toEqual({
      type: "repeat",
      count: 3,
      body: [{ type: "move", steps: kidsMoveSteps(1) }],
    });
  });

  it("returns feedback without a mutating proposal for done, wall and passed", () => {
    expect(
      computeKidsOri(withStatements(first, [{ type: "move", steps: kidsMoveSteps(4) }]), first, 0),
    ).toMatchObject({ kind: "done" });
    expect(
      computeKidsOri(withStatements(first, [{ type: "move", steps: kidsMoveSteps(6) }]), first, 0),
    ).toMatchObject({ kind: "wall" });
    expect(
      computeKidsOri(withStatements(first, [{ type: "move", steps: kidsMoveSteps(5) }]), first, 0),
    ).toMatchObject({ kind: "passed" });
  });

  it("accepted proposal remains one canonical change", () => {
    const program = first.starterProject;
    const offer = computeKidsOri(program, first, 0);
    if (!offer.proposal) throw new Error("missing proposal");
    const review = createProposalReview(program, offer.proposal);
    expect(acceptProposal(program, review).program).toEqual(review.candidateProgram);
  });

  it("serves the builder contract through a local provider runtime", async () => {
    const provider = createKidsOriProviderRuntime(first, 0, "es");
    expect(provider.propose(first.starterProject).kind).toBe("move");
    const request = createLearningCompanionRequest({
      capability: "builder",
      mission: {
        id: first.id,
        version: first.version,
        concepts: first.concepts,
        learningObjective: first.goal.learnerFacing,
      },
      program: first.starterProject,
      selectedNodeIds: [],
      runtimeFacts: [],
      scaffoldHistory: [],
    });
    const result = await provider.request(request);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.response.capability).toBe("builder");
      expect(result.response.metadata.provenance).toBe("deterministic-fake");
    }
  });
});
