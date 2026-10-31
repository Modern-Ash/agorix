import { describe, expect, it } from "vitest";
import { createEditorHistory } from "@agorix/block-editor";
import { projectAgorixCode } from "@agorix/agorix-code";
import { projectProgram } from "@agorix/code-generator";
import { projectJava } from "@agorix/java-projection";
import { projectPython } from "@agorix/python-projection";
import { runMultiActorProgram } from "@agorix/runtime";
import type { Expression, ProjectProgram } from "@agorix/program-model";
import {
  STUDIO_EDGE_CONDITION,
  addStudioVariable,
  createStudioProgram,
  creativeForStudio,
  validateStudioProgram,
} from "./kidsStudioModel.js";

const key: Expression = { type: "keyDown", key: "Space" };
const edge: Expression = STUDIO_EDGE_CONDITION;

function withIf(condition: Expression): ProjectProgram {
  const base = createStudioProgram("nova");
  return validateStudioProgram({
    ...base,
    scripts: [
      {
        ...base.scripts[0]!,
        statements: [{ type: "if", condition, then: [{ type: "move", steps: 40 }] }],
      },
    ],
  });
}

const CONDITIONS: Readonly<Record<string, Expression>> = {
  "key and edge": { type: "and", left: key, right: edge },
  "key or edge": { type: "or", left: key, right: edge },
  "not key": { type: "not", value: key },
  "not (key and edge)": { type: "not", value: { type: "and", left: key, right: edge } },
  "timer <= 3": {
    type: "lessOrEqual",
    left: { type: "timer" },
    right: { type: "numericLiteral", value: 3 },
  },
  "timer >= 3": {
    type: "greaterOrEqual",
    left: { type: "timer" },
    right: { type: "numericLiteral", value: 3 },
  },
};

describe("Scratch operators in the free scene", () => {
  for (const [name, condition] of Object.entries(CONDITIONS)) {
    it(`${name}: validates, runs and projects to every code view`, () => {
      const program = withIf(condition);
      const creative = creativeForStudio(program, "forest", "es");
      expect(runMultiActorProgram(program, creative).outcome).toBe("completed");
      for (const project of [projectPython, projectJava, projectAgorixCode]) {
        const result = project(program);
        expect(result.diagnostics, `${name} diagnostics`).toEqual([]);
        expect(result.text.length, `${name} text`).toBeGreaterThan(10);
      }
      expect(projectProgram(program).code.length).toBeGreaterThan(10);
    });
  }

  it("a negated condition runs the opposite branch", () => {
    // Nothing presses Space, so "not key" holds and the character moves; plain "key" does not.
    const run = (condition: Expression) => {
      const program = withIf(condition);
      return runMultiActorProgram(program, creativeForStudio(program, "forest", "es")).trace.length;
    };
    expect(run({ type: "not", value: key })).toBeGreaterThan(run(key));
  });

  it("decimal random stays inside its range and is repeatable with a seed", () => {
    const history = addStudioVariable(createEditorHistory(createStudioProgram("nova")), "Puntos");
    const base = history.current;
    const program = validateStudioProgram({
      ...base,
      scripts: [
        {
          ...base.scripts[0]!,
          statements: [
            {
              type: "setVariable",
              variableId: "studio-var-1",
              value: {
                type: "random",
                min: { type: "numericLiteral", value: 0 },
                max: { type: "numericLiteral", value: 1 },
              },
            },
          ],
        },
      ],
    });
    const creative = creativeForStudio(program, "forest", "es");
    const value = (seed: number) =>
      runMultiActorProgram(program, creative, { randomSeed: seed }).actors[0]!.world.variables?.[
        "studio-var-1"
      ]?.value as number;
    for (const seed of [1, 2, 3, 4, 5]) {
      expect(value(seed)).toBeGreaterThanOrEqual(0);
      expect(value(seed)).toBeLessThanOrEqual(1);
    }
    expect(value(7)).toBe(value(7));
  });
});
