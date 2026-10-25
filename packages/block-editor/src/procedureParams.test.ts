import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { programToWorkspace, workspaceToProgram } from "./index.js";

// Issue #538: custom block numbers survive the block round trip.
const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  variables: [{ id: "v", name: "total", initialValue: 0, visible: false }],
  scripts: [
    {
      id: "main",
      trigger: { type: "greenFlag" },
      statements: [
        {
          type: "callProcedure",
          procedureId: "proc-1-1",
          args: [
            { type: "numericLiteral", value: 120 },
            { type: "numericLiteral", value: 4 },
          ],
        },
        { type: "callProcedure", procedureId: "proc-1-2" },
      ],
      procedures: [
        {
          id: "proc-1-1",
          name: "Cuadrado",
          params: [
            { id: "p1", name: "lado" },
            { id: "p2", name: "veces" },
          ],
          body: [
            {
              type: "repeat",
              count: 4,
              countFrom: "p2",
              body: [
                { type: "move", steps: 40, stepsFrom: "p1" },
                { type: "turn", degrees: 90, degreesFrom: "p1" },
                { type: "wait", seconds: 1, secondsFrom: "p1" },
              ],
            },
            {
              type: "setVariable",
              variableId: "v",
              value: {
                type: "add",
                left: { type: "param", paramId: "p1" },
                right: { type: "numericLiteral", value: 1 },
              },
            },
          ],
        },
        { id: "proc-1-2", name: "Paso", body: [{ type: "move", steps: 40 }] },
      ],
    },
  ],
};

describe("custom block numbers in blocks", () => {
  it("round-trips numbers, bound fields, the number expression and call arguments", () => {
    const { workspace } = programToWorkspace(program);
    expect(workspaceToProgram(workspace).program).toEqual(program);
  });

  it("represents a bound field and the call arguments as plain block data", () => {
    const { workspace } = programToWorkspace(program);
    const script = workspace.scripts[0]!;
    const call = script.statements[0]!;
    expect(call.type).toBe("procedures_call");
    expect(call.inputs?.arg1?.fields).toEqual({ value: 120 });
    expect(call.inputs?.arg2?.fields).toEqual({ value: 4 });
    expect(call.inputs).not.toHaveProperty("arg3");
    const repeat = script.procedures![0]!.body[0]!;
    expect(repeat.fields).toEqual({ count: 4, countFrom: "p2" });
    expect(script.procedures![0]!.params).toEqual(program.scripts[0]!.procedures![0]!.params);
    expect(JSON.stringify(workspace)).toContain("procedures_param");
  });

  it("leaves blocks without numbers unchanged: no From field, no inputs", () => {
    const { workspace } = programToWorkspace(program);
    const plainCall = workspace.scripts[0]!.statements[1]!;
    expect(plainCall.inputs).toBeUndefined();
    const plainMove = workspace.scripts[0]!.procedures![1]!.body[0]!;
    expect(plainMove.fields).toEqual({ steps: 40 });
    expect(workspace.scripts[0]!.procedures![1]!).not.toHaveProperty("params");
  });

  it("rejects a bound field that points outside its block, and a call with a non-number argument", () => {
    const { workspace } = programToWorkspace(program);
    const tampered = structuredClone(workspace) as {
      scripts: { statements: { fields?: Record<string, unknown> }[] }[];
    };
    tampered.scripts[0]!.statements.push({
      type: "motion_move",
      id: "x",
      fields: { steps: 40, stepsFrom: "p1" },
    } as never);
    expect(() => workspaceToProgram(tampered as never)).toThrow();
    const bad = structuredClone(workspace) as {
      scripts: { statements: { inputs?: Record<string, unknown> }[] }[];
    };
    bad.scripts[0]!.statements[0]!.inputs = {
      arg1: { id: "q", type: "variables_value", fields: { variableId: "v" } },
      arg2: { id: "r", type: "literal_number", fields: { value: 4 } },
    };
    expect(() => workspaceToProgram(bad as never)).toThrow();
  });
});
