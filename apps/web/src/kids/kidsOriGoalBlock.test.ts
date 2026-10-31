import { describe, expect, it } from "vitest";
import { acceptProposal, rejectProposal } from "@agorix/proposals";
import { createEditorHistory } from "@agorix/block-editor";
import type { ProjectSceneGoal } from "@agorix/persistence";
import {
  addStudioActor,
  appendStudioStatement,
  createStudioProgram,
  validateStudioProgram,
} from "./kidsStudioModel.js";
import {
  goalBlockCandidates,
  oriGoalStatement,
  proposeOriGoalBlock,
  reviewOriGoalBlock,
} from "./kidsOriGoalBlock.js";

const NOVA = "actor:studio-1-nova";
const MIKA = "actor:studio-2-mika";
const names = (id: string) => (id === NOVA ? "Nova" : "Mika");
const touch: ProjectSceneGoal = { kind: "touchActor", actorId: NOVA, targetId: MIKA };
const edge: ProjectSceneGoal = { kind: "reachEdge", actorId: NOVA };

const duo = () => addStudioActor(createEditorHistory(createStudioProgram("nova")), "mika");

describe("Ori suggests a block the goal needs (issue #1135)", () => {
  it("starts with Move, then facing the target, then Repeat, skipping what is already used", () => {
    const program = duo().current;
    expect(goalBlockCandidates(program, touch)).toEqual(["move", "pointTowards", "repeat"]);
    expect(goalBlockCandidates(program, edge)).toEqual(["move", "repeat"]);
    const moved = appendStudioStatement(duo(), NOVA, { type: "move", steps: 40 }).current;
    expect(goalBlockCandidates(moved, touch)).toEqual(["pointTowards", "repeat"]);
  });

  it("proposes a valid, visible append that does not change the program until accepted", () => {
    const history = duo();
    const proposal = proposeOriGoalBlock(history.current, touch, "pointTowards", names, "es");
    expect(proposal.rationale).toContain("Mika");
    expect(JSON.stringify(history.current)).not.toContain("pointTowards");
    const review = reviewOriGoalBlock(history.current, touch, proposal);
    const accepted = validateStudioProgram(acceptProposal(history.current, review).program);
    expect(accepted.scripts[0]!.statements).toEqual([oriGoalStatement("pointTowards", touch)]);
  });

  it("leaves the program untouched when the child rejects", () => {
    const history = duo();
    const proposal = proposeOriGoalBlock(history.current, edge, "move", names, "en");
    const review = reviewOriGoalBlock(history.current, edge, proposal);
    rejectProposal(history.current, review);
    expect(history.current.scripts[0]!.statements).toEqual([]);
  });

  it("refuses blocks the goal does not need, a stale position or a tampered statement", () => {
    const history = duo();
    expect(() => proposeOriGoalBlock(history.current, edge, "pointTowards", names, "es")).toThrow();
    const proposal = proposeOriGoalBlock(history.current, edge, "move", names, "es");
    const moved = appendStudioStatement(history, NOVA, { type: "move", steps: 40 }).current;
    expect(() => reviewOriGoalBlock(moved, edge, proposal)).toThrow();
    const tampered = {
      ...proposal,
      operations: [
        { type: "appendStatement" as const, scriptIndex: 0, statement: { type: "hide" as const } },
      ],
    };
    expect(() => reviewOriGoalBlock(history.current, edge, tampered)).toThrow();
  });
});
