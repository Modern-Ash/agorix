import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type Expression, type ProjectProgram } from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";

const program = (condition: Expression): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        { type: "waitUntil", condition },
        { type: "move", steps: 10 },
      ],
    },
  ],
});

describe("waitUntil", () => {
  it("continues immediately when the condition is already true", () => {
    const result = runProgram(program({ type: "booleanLiteral", value: true }), createWorldState());
    expect(result.outcome).toBe("completed");
    expect(result.virtualSeconds).toBeUndefined();
    expect(result.trace.map((entry) => entry.statementType)).toEqual(["waitUntil", "move"]);
    expect(result.trace[0]?.conditionResult).toBe(true);
  });
  it("advances virtual time deterministically until a timer condition becomes true", () => {
    const condition: Expression = {
      type: "greaterOrEqual",
      left: { type: "timer" },
      right: { type: "numericLiteral", value: 3 },
    };
    const first = runProgram(program(condition), createWorldState());
    const second = runProgram(program(condition), createWorldState());
    expect(first).toEqual(second);
    expect(first.outcome).toBe("completed");
    expect(first.virtualSeconds).toBe(3);
    expect(first.world.sprite.x).toBe(10);
  });
  it("stops after ten virtual seconds and records the reason in trace and notes", () => {
    const result = runProgram(
      program({ type: "booleanLiteral", value: false }),
      createWorldState(),
    );
    expect(result.outcome).toBe("stopped");
    expect(result.virtualSeconds).toBe(10);
    expect(result.stepsUsed).toBe(1);
    expect(result.trace.map((entry) => entry.statementType)).toEqual(["waitUntil"]);
    expect(result.trace[0]).toMatchObject({
      conditionResult: false,
      note: "waitUntil: stopped after 10 virtual seconds",
    });
    expect(result.notes).toContain("waitUntil: stopped after 10 virtual seconds");
    expect(result.world.sprite.x).toBe(0);
  });
});
