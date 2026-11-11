import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  validateProgram,
  type Expression,
  type ProjectProgram,
} from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";

// Scratch's `touching mouse-pointer?` and `distance to mouse-pointer`.
function run(expression: Expression, pointer: { x: number; y: number; down: boolean }) {
  const program: ProjectProgram = validateProgram({
    schema: SCHEMA_VERSION,
    variables: [{ id: "v", name: "v", initialValue: 0, visible: true }],
    scripts: [
      {
        id: "main",
        trigger: { type: "onStart" },
        statements: [
          { type: "goTo", x: 100, y: 0 },
          {
            type: "if",
            condition: expression,
            then: [
              { type: "setVariable", variableId: "v", value: { type: "numericLiteral", value: 1 } },
            ],
          },
        ],
      },
    ],
  } as unknown as ProjectProgram);
  return runProgram(program, createWorldState(), { pointer });
}

describe("mouse sensors", () => {
  it("is touching when the pointer is within the contact radius, and not otherwise", () => {
    expect(
      run({ type: "touchingMouse" }, { x: 110, y: 5, down: false }).world.variables?.["v"]?.value,
    ).toBe(1);
    expect(
      run({ type: "touchingMouse" }, { x: 200, y: 0, down: false }).world.variables?.["v"]?.value,
    ).toBe(0);
  });

  it("measures the distance to the pointer on the stage", () => {
    const program = validateProgram({
      schema: SCHEMA_VERSION,
      variables: [{ id: "v", name: "v", initialValue: 0, visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            { type: "goTo", x: 100, y: 0 },
            { type: "setVariable", variableId: "v", value: { type: "distanceToMouse" } },
          ],
        },
      ],
    } as unknown as ProjectProgram);
    const result = runProgram(program, createWorldState(), {
      pointer: { x: 130, y: 40, down: false },
    });
    expect(result.world.variables?.["v"]?.value).toBe(50);
  });
});
