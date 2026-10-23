import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";

// Issue #463: exactly one branch runs; programs without else behave as before.
const program = (
  statements: ProjectProgram["scripts"][number]["statements"],
  variables?: ProjectProgram["variables"],
): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  ...(variables ? { variables } : {}),
  scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
});
const yes = { type: "booleanLiteral", value: true } as const;
const no = { type: "booleanLiteral", value: false } as const;

describe("if / else runtime (issue #463)", () => {
  it("runs then when true and skips else", () => {
    const result = runProgram(
      program([
        {
          type: "if",
          condition: yes,
          then: [{ type: "move", steps: 3 }],
          else: [{ type: "move", steps: 9 }],
        },
      ]),
      createWorldState(),
    );
    expect(result.world.sprite.x).toBe(3);
  });

  it("runs else when false and skips then", () => {
    const result = runProgram(
      program([
        {
          type: "if",
          condition: no,
          then: [{ type: "move", steps: 3 }],
          else: [{ type: "move", steps: 9 }],
        },
      ]),
      createWorldState(),
    );
    expect(result.world.sprite.x).toBe(9);
    expect(result.trace.map((entry) => entry.nodeId)).toContain("scripts[0]/statements[0]/else[0]");
  });

  it("an empty else and a missing else do nothing", () => {
    const base = { type: "if", condition: no, then: [{ type: "move", steps: 3 }] } as const;
    for (const statement of [base, { ...base, else: [] }]) {
      const result = runProgram(program([statement]), createWorldState());
      expect(result.world.sprite.x).toBe(0);
      expect(result.outcome).toBe("completed");
    }
  });

  it("nested if / else picks the right leaf", () => {
    const result = runProgram(
      program([
        {
          type: "if",
          condition: no,
          then: [{ type: "move", steps: 1 }],
          else: [
            {
              type: "if",
              condition: yes,
              then: [{ type: "move", steps: 5 }],
              else: [{ type: "move", steps: 7 }],
            },
          ],
        },
      ]),
      createWorldState(),
    );
    expect(result.world.sprite.x).toBe(5);
  });

  it("evaluates the condition once, even if a branch changes the variable it reads", () => {
    const result = runProgram(
      program(
        [
          {
            type: "if",
            condition: {
              type: "greaterThan",
              left: { type: "variable", variableId: "n" },
              right: { type: "numericLiteral", value: 0 },
            },
            then: [
              { type: "setVariable", variableId: "n", value: { type: "numericLiteral", value: 0 } },
            ],
            else: [{ type: "move", steps: 4 }],
          },
        ],
        [{ id: "n", name: "n", initialValue: 1, visible: false }],
      ),
      createWorldState(),
    );
    expect(result.world.sprite.x).toBe(0);
    expect(result.world.variables?.["n"]?.value).toBe(0);
  });
});
