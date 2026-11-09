import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram, type Statement } from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";

const program = (statements: Statement[]): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [{ id: "main", trigger: { type: "greenFlag" }, statements }],
});

const ifBigger = (): Statement => ({
  type: "if",
  condition: {
    type: "greaterThan",
    left: { type: "sizePercent" },
    right: { type: "numericLiteral", value: 100 },
  },
  then: [{ type: "move", steps: 10 }],
});

describe("size as a value", () => {
  it("is 100 until something changes it, so the condition is false", () => {
    expect(runProgram(program([ifBigger()]), createWorldState()).world.sprite.x).toBe(0);
  });
  it("follows the size blocks, so the condition becomes true after growing", () => {
    const run = runProgram(
      program([{ type: "changeSize", delta: 50 }, ifBigger()]),
      createWorldState(),
    );
    expect(run.world.sprite.x).toBe(10);
  });
});
