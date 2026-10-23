import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { programToWorkspace, workspaceToProgram } from "./index.js";

const one = { type: "numericLiteral", value: 1 } as const;
const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  variables: [{ id: "r", name: "r", initialValue: 0, visible: false }],
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        {
          type: "setVariable",
          variableId: "r",
          value: { type: "randomInteger", min: one, max: { type: "numericLiteral", value: 6 } },
        },
      ],
    },
  ],
};

describe("randomInteger blocks (issue #467)", () => {
  it("round-trips through blocks and keeps random distinct", () => {
    const { workspace } = programToWorkspace(program);
    expect(workspaceToProgram(workspace).program).toEqual(program);
  });
});
