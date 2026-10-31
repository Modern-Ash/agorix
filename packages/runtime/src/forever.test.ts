import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        { type: "forever", body: [{ type: "move", steps: 1 }] },
        { type: "move", steps: 20 },
      ],
    },
  ],
};

describe("forever budget", () => {
  it("records entry and repeated body, then stops exactly at the step budget", () => {
    const first = runProgram(program, createWorldState(), { maxSteps: 5 });
    const second = runProgram(program, createWorldState(), { maxSteps: 5 });
    expect(first).toEqual(second);
    expect(first.outcome).toBe("budget-exceeded");
    expect(first.stepsUsed).toBe(5);
    expect(first.trace.map((entry) => entry.statementType)).toEqual([
      "forever",
      "move",
      "move",
      "move",
      "move",
    ]);
    expect(first.trace[0]?.note).toBe("forever: bounded by runtime budgets");
    expect(first.notes).toContain("forever: stopped at runtime budget");
    expect(first.world.sprite.x).toBe(4);
  });
  it("lets an explicit stop in the body end the scene before budget", () => {
    const stopped: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "forever", body: [{ type: "stop", scope: "scene" }] }],
        },
      ],
    };
    const result = runProgram(stopped, createWorldState(), { maxSteps: 5 });
    expect(result.outcome).toBe("stopped");
    expect(result.trace.map((entry) => entry.statementType)).toEqual(["forever", "stop"]);
  });
  it("retains the existing virtual-time safety limit for a body with wait", () => {
    const waiting: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "forever", body: [{ type: "wait", seconds: 1 }] }],
        },
      ],
    };
    const result = runProgram(waiting, createWorldState(), { maxSteps: 1000 });
    expect(result.outcome).toBe("budget-exceeded");
    expect(result.stepsUsed).toBeLessThan(1000);
    expect(result.trace[0]?.statementType).toBe("forever");
    expect(result.notes).toContain("forever: stopped at runtime budget");
  });
});
