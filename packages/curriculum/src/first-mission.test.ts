import { describe, expect, it } from "vitest";
import { runProgram } from "@agorix/runtime";
import { FIRST_MISSION_STARTING_PROGRAM, FIRST_MISSION_WORLD } from "./first-mission.js";

describe("First Mission", () => {
  it("does not reach the goal with the unmodified starting program", () => {
    const result = runProgram(FIRST_MISSION_STARTING_PROGRAM, FIRST_MISSION_WORLD);
    expect(result.reachedGoal).toBe(false);
  });

  it("reaches the goal once the missing distance is added", () => {
    const completed = {
      ...FIRST_MISSION_STARTING_PROGRAM,
      scripts: [
        {
          ...FIRST_MISSION_STARTING_PROGRAM.scripts[0]!,
          statements: [
            ...FIRST_MISSION_STARTING_PROGRAM.scripts[0]!.statements,
            { type: "move" as const, steps: 10 },
          ],
        },
      ],
    };
    const result = runProgram(completed, FIRST_MISSION_WORLD);
    expect(result.reachedGoal).toBe(true);
  });
});
