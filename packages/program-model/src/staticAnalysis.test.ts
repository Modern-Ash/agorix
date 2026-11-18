import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "./schema.js";
import {
  analyzeProgramBeforePlay,
  analyzeProgramBudget,
  analyzeProgramLoops,
  analyzeProgramSharedWrites,
} from "./staticAnalysis.js";

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

describe("analyzeProgramSharedWrites", () => {
  const program: ProjectProgram = {
    ...base,
    variables: [{ id: "score", name: "Score", initialValue: 0, visible: true }],
    lists: [{ id: "items", name: "Items", initialItems: [], visible: true }],
    scripts: [
      {
        id: "first",
        trigger: { type: "onStart" },
        statements: [
          { type: "setVariable", variableId: "score", value: { type: "numericLiteral", value: 1 } },
          { type: "listAdd", listId: "items", value: { type: "numericLiteral", value: 1 } },
          { type: "move", steps: 1 },
        ],
      },
      {
        id: "second",
        trigger: { type: "greenFlag" },
        statements: [
          {
            type: "changeVariable",
            variableId: "score",
            delta: { type: "numericLiteral", value: 1 },
          },
          { type: "listRemoveAt", listId: "items", index: { type: "numericLiteral", value: 1 } },
          { type: "goTo", x: 2, y: 2 },
        ],
      },
    ],
  };

  it("reports both canonical writers for shared declarations and one actor's position", () => {
    expect(analyzeProgramSharedWrites(program, { first: "actor:a", second: "actor:a" })).toEqual([
      {
        kind: "shared-variable",
        nodeId: "scripts[0]/statements[0]",
        relatedNodeId: "scripts[1]/statements[0]",
      },
      {
        kind: "shared-list",
        nodeId: "scripts[0]/statements[1]",
        relatedNodeId: "scripts[1]/statements[1]",
      },
      {
        kind: "shared-position",
        nodeId: "scripts[0]/statements[2]",
        relatedNodeId: "scripts[1]/statements[2]",
      },
    ]);
  });

  it("does not report distinct actors or events as position races", () => {
    expect(
      analyzeProgramSharedWrites(program, { first: "actor:a", second: "actor:b" }).map(
        (item) => item.kind,
      ),
    ).toEqual(["shared-variable", "shared-list"]);
    const differentEvent: ProjectProgram = {
      ...program,
      scripts: [
        program.scripts[0]!,
        { ...program.scripts[1]!, trigger: { type: "onKeyPressed", key: "Space" } },
      ],
    };
    expect(
      analyzeProgramSharedWrites(differentEvent, { first: "actor:a", second: "actor:a" }),
    ).toEqual([]);
  });
});

describe("analyzeProgramBudget", () => {
  const longRepeat = (count: number): ProjectProgram["scripts"][number]["statements"][number] => ({
    type: "repeat",
    count,
    body: [{ type: "move", steps: 1 }],
  });

  it("warns when one loop or copies activated by one event can exceed the runtime budget", () => {
    expect(analyzeProgramBudget(withStatements([longRepeat(1000)]), 1000)).toEqual([
      { kind: "performance-budget", nodeId: "scripts[0]/statements[0]" },
    ]);
    const copies: ProjectProgram = {
      ...base,
      scripts: [
        { id: "first", trigger: { type: "onStart" }, statements: [longRepeat(600)] },
        { id: "second", trigger: { type: "greenFlag" }, statements: [longRepeat(600)] },
      ],
    };
    expect(analyzeProgramBudget(copies, 1000)).toEqual([
      {
        kind: "performance-budget",
        nodeId: "scripts[0]/statements[0]",
        relatedNodeId: "scripts[1]/statements[0]",
      },
    ]);
    expect(analyzeProgramBeforePlay(copies, { executionBudget: 1000 })).toEqual(
      analyzeProgramBudget(copies, 1000),
    );
  });

  it("does not warn for small work or scripts that respond to different events", () => {
    expect(analyzeProgramBudget(withStatements([longRepeat(4)]), 1000)).toEqual([]);
    const separate: ProjectProgram = {
      ...base,
      scripts: [
        { id: "first", trigger: { type: "onStart" }, statements: [longRepeat(600)] },
        {
          id: "second",
          trigger: { type: "onMessage", message: "go" },
          statements: [longRepeat(600)],
        },
      ],
    };
    expect(analyzeProgramBudget(separate, 1000)).toEqual([]);
    expect(analyzeProgramBudget(separate, 0)).toEqual([]);
  });
});
