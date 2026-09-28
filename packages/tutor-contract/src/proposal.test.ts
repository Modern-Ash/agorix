import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { runProgram, type WorldConfig } from "@agorix/runtime";
import { applyProposal, proposeCompletion } from "./proposal.js";

const WORLD: WorldConfig = {
  start: { x: 0, y: 0 },
  startHeading: 0,
  goal: { x: 30, y: 0 },
  goalRadius: 2,
};

const PROGRAM: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [{ type: "move", steps: 20 }] }],
};

describe("proposeCompletion", () => {
  it("proposes nothing once the goal is already reached", () => {
    const run = runProgram({ ...PROGRAM, scripts: [{ ...PROGRAM.scripts[0]!, statements: [{ type: "move", steps: 30 }] }] }, WORLD);
    expect(proposeCompletion(PROGRAM, run, WORLD)).toBeNull();
  });

  it("proposes a bounded append derived only from the real last observation", () => {
    const run = runProgram(PROGRAM, WORLD);
    const proposal = proposeCompletion(PROGRAM, run, WORLD);
    expect(proposal).not.toBeNull();
    expect(proposal?.kind).toBe("append-statements");
    expect(proposal?.statements).toEqual([{ type: "move", steps: 10 }]);
    expect(proposal?.rationale).toContain("20.0");
  });

  it("is deterministic: same program/run always yields the same proposal", () => {
    const run = runProgram(PROGRAM, WORLD);
    expect(proposeCompletion(PROGRAM, run, WORLD)).toEqual(proposeCompletion(PROGRAM, run, WORLD));
  });
});

describe("applyProposal / acceptance boundary (AC-006)", () => {
  it("never mutates the program unless applyProposal is explicitly called", () => {
    const run = runProgram(PROGRAM, WORLD);
    const proposal = proposeCompletion(PROGRAM, run, WORLD);
    expect(proposal).not.toBeNull();
    // Merely generating a proposal must not change the program or its outcome.
    const rerun = runProgram(PROGRAM, WORLD);
    expect(rerun.reachedGoal).toBe(false);
  });

  it("a rejected proposal must never reach applyProposal — the caller enforces this, not the contract itself", () => {
    // Simulates a UI acceptance gate: rejection short-circuits before applyProposal.
    const decision: "accepted" | "rejected" = "rejected";
    const run = runProgram(PROGRAM, WORLD);
    const proposal = proposeCompletion(PROGRAM, run, WORLD)!;
    let finalProgram = PROGRAM;
    if (decision === "accepted") {
      finalProgram = applyProposal(PROGRAM, proposal);
    }
    expect(finalProgram).toBe(PROGRAM);
    expect(runProgram(finalProgram, WORLD).reachedGoal).toBe(false);
  });

  it("applying an accepted proposal reaches the goal deterministically", () => {
    const run = runProgram(PROGRAM, WORLD);
    const proposal = proposeCompletion(PROGRAM, run, WORLD)!;
    const updated = applyProposal(PROGRAM, proposal);
    expect(runProgram(updated, WORLD).reachedGoal).toBe(true);
  });
});
