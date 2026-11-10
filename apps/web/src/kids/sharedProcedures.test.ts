import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { projectProgram } from "@agorix/code-generator";
import { projectPython } from "@agorix/python-projection";
import { projectJava } from "@agorix/java-projection";
import { projectAgorixCode } from "@agorix/agorix-code";
import { programToWorkspace, workspaceToProgram } from "@agorix/block-editor";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  sharedProcedures: [{ id: "shared-1", name: "Salto", body: [{ type: "move", steps: 10 }] }],
  scripts: [
    {
      id: "a",
      trigger: { type: "greenFlag" },
      statements: [{ type: "callProcedure", procedureId: "shared-1" }],
    },
  ],
};

describe("shared custom blocks in the editor and the code views", () => {
  it("travel through the block workspace and back without being lost", () => {
    const { workspace } = programToWorkspace(program);
    expect(workspace.sharedProcedures).toEqual(program.sharedProcedures);
    expect(workspaceToProgram(workspace).program).toEqual(program);
  });

  it("are refused by every code view instead of being shown half-written", () => {
    for (const project of [projectProgram, projectPython, projectJava, projectAgorixCode])
      expect(() => project(program)).toThrow(/shared custom blocks/);
  });
});
