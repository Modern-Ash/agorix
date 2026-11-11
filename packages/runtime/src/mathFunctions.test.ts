import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  type MathFunction,
  type ProjectProgram,
  validateProgram,
} from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";

// Scratch's math reporters: angles in degrees; a non-number answer reads as 0.
function answer(name: MathFunction, value: number): number {
  const program: ProjectProgram = {
    schema: SCHEMA_VERSION,
    variables: [{ id: "v", name: "v", initialValue: 0, visible: true }],
    scripts: [
      {
        id: "main",
        trigger: { type: "onStart" },
        statements: [
          {
            type: "setVariable",
            variableId: "v",
            value: {
              type: "mathFunction",
              function: name,
              value: { type: "numericLiteral", value },
            },
          },
        ],
      },
    ],
  };
  const result = runProgram(validateProgram(program), createWorldState());
  expect(result.outcome).toBe("completed");
  return result.world.variables?.["v"]?.value as number;
}

describe("math functions", () => {
  it.each<[MathFunction, number, number]>([
    ["sqrt", 9, 3],
    ["sin", 90, 1],
    ["sin", 30, 0.5],
    ["cos", 180, -1],
    ["cos", 90, 0],
    ["tan", 45, 1],
    ["asin", 1, 90],
    ["acos", 0, 90],
    ["atan", 1, 45],
    ["ln", 1, 0],
    ["log", 1000, 3],
    ["exp", 0, 1],
    ["pow10", 3, 1000],
  ])("%s of %d is %d", (name, input, expected) => {
    expect(answer(name, input)).toBeCloseTo(expected, 9);
  });

  it("answers 0 where Scratch has no number", () => {
    expect(answer("sqrt", -4)).toBe(0);
    expect(answer("ln", 0)).toBe(0);
    expect(answer("log", -1)).toBe(0);
    expect(answer("asin", 2)).toBe(0);
    expect(answer("tan", 90)).toBe(0);
  });
});
