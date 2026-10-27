import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { createOriCanonicalExecutionPort } from "./oriCanonicalExecutionPort.js";
const program = (count: number): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: Array.from({ length: count }, () => ({ type: "move" as const, steps: 1 })),
    },
  ],
});
describe("Ori canonical execution port", () => {
  it("executes a real program with a bounded trace", async () => {
    const execute = createOriCanonicalExecutionPort({
      world: { goal: { x: 10, y: 0 } },
      maxSteps: 10,
    });
    const { result } = await execute(program(2));
    expect(result.outcome).toBe("completed");
    expect(result.trace.map((step) => step.statementType)).toEqual(["move", "move"]);
    expect(result.stepsUsed).toBe(2);
  });
  it("fails closed for a program exceeding its step budget", async () => {
    const execute = createOriCanonicalExecutionPort({
      world: { goal: { x: 100, y: 0 } },
      maxSteps: 1,
    });
    const { result } = await execute(program(3));
    expect(result.outcome).toBe("budget-exceeded");
  });
  it("rejects invalid execution budgets", () => {
    expect(() => createOriCanonicalExecutionPort({ world: {}, maxSteps: 101 })).toThrow();
    expect(() => createOriCanonicalExecutionPort({ world: {}, maxSteps: 0 })).toThrow();
  });
});
