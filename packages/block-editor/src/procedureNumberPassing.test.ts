import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { programToWorkspace, workspaceToProgram } from "./index.js";

// Issue #735: a custom block hands its own number on to another block.
const PASS: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "greenFlag" },
      statements: [
        {
          type: "callProcedure",
          procedureId: "proc-1-2",
          args: [{ type: "numericLiteral", value: 60 }],
        },
      ],
      procedures: [
        {
          id: "proc-1-1",
          name: "Avanzar",
          params: [{ id: "p1", name: "largo" }],
          body: [{ type: "move", steps: 20, stepsFrom: "p1" }],
        },
        {
          id: "proc-1-2",
          name: "Doble",
          params: [{ id: "p1", name: "base" }],
          body: [
            {
              type: "callProcedure",
              procedureId: "proc-1-1",
              args: [{ type: "param", paramId: "p1" }],
            },
          ],
        },
      ],
    },
  ],
};

describe("a number passed to another custom block", () => {
  it("is derived from the same program", () => {
    const { workspace } = programToWorkspace(PASS);
    expect(workspaceToProgram(workspace).program).toEqual(PASS);
  });
});
