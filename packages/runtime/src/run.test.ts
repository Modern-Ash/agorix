import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { RuntimeStepLimitError, describeRunResult, runProgram, type WorldConfig } from "./run.js";

const WORLD: WorldConfig = {
  start: { x: 0, y: 0 },
  startHeading: 0,
  goal: { x: 30, y: 0 },
  goalRadius: 2,
};

function programWithSteps(steps: readonly { type: "move"; steps: number }[]): ProjectProgram {
  return {
    schema: SCHEMA_VERSION,
    scripts: [{ id: "main", trigger: { type: "onStart" }, statements: steps }],
  };
}

describe("runProgram", () => {
  it("moves the sprite deterministically along heading 0", () => {
    const program = programWithSteps([{ type: "move", steps: 10 }, { type: "move", steps: 10 }]);
    const result = runProgram(program, WORLD);
    expect(result.finalPosition.x).toBeCloseTo(20);
    expect(result.finalPosition.y).toBeCloseTo(0);
    expect(result.reachedGoal).toBe(false);
    expect(result.observations).toHaveLength(2);
    expect(result.observations[0]?.nodeId).toBe("scripts[0]/statements[0]");
  });

  it("reaches the goal only when actually within goalRadius", () => {
    const program = programWithSteps([{ type: "move", steps: 30 }]);
    const result = runProgram(program, WORLD);
    expect(result.reachedGoal).toBe(true);
    expect(result.observations[0]?.touchingGoal).toBe(true);
  });

  it("produces one observation per repeat iteration, addressed by nested node id", () => {
    const program: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "repeat", count: 3, body: [{ type: "move", steps: 10 }] }],
        },
      ],
    };
    const result = runProgram(program, WORLD);
    expect(result.observations).toHaveLength(3);
    expect(result.observations.map((o) => o.nodeId)).toEqual([
      "scripts[0]/statements[0]/body[0]",
      "scripts[0]/statements[0]/body[0]",
      "scripts[0]/statements[0]/body[0]",
    ]);
    expect(result.reachedGoal).toBe(true);
  });

  it("evaluates touchingGoal against real runtime state, not a claim", () => {
    const program: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            { type: "move", steps: 30 },
            {
              type: "if",
              condition: { type: "touchingGoal" },
              then: [{ type: "turn", degrees: 90 }],
            },
          ],
        },
      ],
    };
    const result = runProgram(program, WORLD);
    expect(result.observations).toHaveLength(2);
    expect(result.observations[1]?.statementType).toBe("turn");
    expect(result.finalHeading).toBe(90);
  });

  it("is pure: identical program and world yield byte-identical results", () => {
    const program = programWithSteps([{ type: "move", steps: 7 }]);
    const first = runProgram(program, WORLD);
    const second = runProgram(program, WORLD);
    expect(first).toEqual(second);
  });

  it("throws RuntimeStepLimitError instead of hanging on runaway repeats", () => {
    const program: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "repeat", count: 10, body: [{ type: "move", steps: 1 }] }],
        },
      ],
    };
    expect(() => runProgram(program, WORLD, { maxSteps: 5 })).toThrow(RuntimeStepLimitError);
  });
});

describe("describeRunResult", () => {
  it("cites the actual final observation when the goal was not reached", () => {
    const program = programWithSteps([{ type: "move", steps: 10 }]);
    const result = runProgram(program, WORLD);
    const message = describeRunResult(result, WORLD);
    expect(message).toContain("scripts[0]/statements[0]");
    expect(message).toContain("move");
    expect(message).toContain("20.0");
  });

  it("reports success only when reachedGoal is true", () => {
    const program = programWithSteps([{ type: "move", steps: 30 }]);
    const result = runProgram(program, WORLD);
    const message = describeRunResult(result, WORLD);
    expect(message).toContain("Reached the goal");
  });

  it("does not fabricate a position when no statement ran", () => {
    const program: ProjectProgram = { schema: SCHEMA_VERSION, scripts: [] };
    const result = runProgram(program, WORLD);
    const message = describeRunResult(result, WORLD);
    expect(message).toContain("ran no statements");
    expect(message).toContain(`(${WORLD.start.x}, ${WORLD.start.y})`);
  });
});
