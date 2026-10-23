import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type Expression, type ProjectProgram } from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";

// Issue #464: <= and >= truth tables through the real runtime.
const num = (value: number): Expression => ({ type: "numericLiteral", value });
const program = (condition: Expression, variableValue = 0): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  variables: [{ id: "n", name: "n", initialValue: variableValue, visible: false }],
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        {
          type: "if",
          condition,
          then: [{ type: "move", steps: 1 }],
          else: [{ type: "move", steps: 2 }],
        },
      ],
    },
  ],
});
const ran = (condition: Expression, variableValue?: number): boolean =>
  runProgram(program(condition, variableValue), createWorldState()).world.sprite.x === 1;

describe("lessOrEqual / greaterOrEqual (issue #464)", () => {
  const cases: ReadonlyArray<readonly [number, number, boolean, boolean]> = [
    // left, right, <=, >=
    [1, 2, true, false],
    [2, 2, true, true],
    [3, 2, false, true],
    [-1, 0, true, false],
    [-2, -2, true, true],
    [0, -0, true, true],
    [0.5, 0.5, true, true],
  ];
  for (const [left, right, le, ge] of cases) {
    it(`${left} vs ${right}`, () => {
      expect(ran({ type: "lessOrEqual", left: num(left), right: num(right) })).toBe(le);
      expect(ran({ type: "greaterOrEqual", left: num(left), right: num(right) })).toBe(ge);
    });
  }

  it("compares a variable with a literal", () => {
    const variable: Expression = { type: "variable", variableId: "n" };
    expect(ran({ type: "greaterOrEqual", left: variable, right: num(3) }, 3)).toBe(true);
    expect(ran({ type: "greaterOrEqual", left: variable, right: num(3) }, 2)).toBe(false);
    expect(ran({ type: "lessOrEqual", left: variable, right: num(3) }, 3)).toBe(true);
    expect(ran({ type: "lessOrEqual", left: variable, right: num(3) }, 4)).toBe(false);
  });

  it("existing strict comparators are unchanged", () => {
    expect(ran({ type: "lessThan", left: num(2), right: num(2) })).toBe(false);
    expect(ran({ type: "greaterThan", left: num(2), right: num(2) })).toBe(false);
  });
});
