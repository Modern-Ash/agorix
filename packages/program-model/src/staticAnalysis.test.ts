import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "./schema.js";
import { analyzeProgramLoops } from "./staticAnalysis.js";

const base: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [] }],
};

function withStatements(
  statements: ProjectProgram["scripts"][number]["statements"],
): ProjectProgram {
  return { ...base, scripts: [{ ...base.scripts[0]!, statements }] };
}

describe("analyzeProgramLoops", () => {
  it("finds a never-ending loop and a nested loop without a wait", () => {
    const program = withStatements([
      {
        type: "repeatUntil",
        condition: { type: "booleanLiteral", value: false },
        body: [{ type: "move", steps: 1 }],
      },
      {
        type: "if",
        condition: { type: "booleanLiteral", value: true },
        then: [
          {
            type: "repeatUntil",
            condition: { type: "touchingGoal" },
            body: [{ type: "move", steps: 1 }],
          },
        ],
      },
    ]);
    expect(analyzeProgramLoops(program)).toEqual([
      { kind: "loop-never-exits", nodeId: "scripts[0]/statements[0]" },
      { kind: "loop-without-wait", nodeId: "scripts[0]/statements[1]/then[0]" },
    ]);
    expect(program.scripts[0]?.statements).toHaveLength(2);
  });

  it("does not flag a loop that ends immediately or may wait through a custom block", () => {
    const script = withStatements([
      {
        type: "repeatUntil",
        condition: { type: "booleanLiteral", value: true },
        body: [{ type: "move", steps: 1 }],
      },
      {
        type: "repeatUntil",
        condition: { type: "touchingGoal" },
        body: [{ type: "wait", seconds: 1 }],
      },
      {
        type: "repeatUntil",
        condition: { type: "touchingGoal" },
        body: [{ type: "callProcedure", procedureId: "unknown" }],
      },
    ]);
    const program: ProjectProgram = {
      ...script,
      scripts: [
        {
          ...script.scripts[0]!,
          procedures: [{ id: "unknown", name: "Pause", body: [{ type: "wait", seconds: 1 }] }],
        },
      ],
    };
    expect(analyzeProgramLoops(program)).toEqual([]);
  });

  it("reports a loop inside a reusable procedure with a canonical path", () => {
    const program: ProjectProgram = {
      ...base,
      scripts: [
        {
          ...base.scripts[0]!,
          procedures: [
            {
              id: "proc-1",
              name: "Orbit",
              body: [
                {
                  type: "repeatUntil",
                  condition: { type: "booleanLiteral", value: false },
                  body: [{ type: "move", steps: 1 }],
                },
              ],
            },
          ],
        },
      ],
    };
    expect(analyzeProgramLoops(program)).toEqual([
      { kind: "loop-never-exits", nodeId: "scripts[0]/procedures[0]/body[0]" },
    ]);
  });
});
