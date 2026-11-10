import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { projectProgramLanguage } from "@agorix/code-generator";
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

  const withOwn: ProjectProgram = {
    ...program,
    scripts: [
      {
        id: "a",
        trigger: { type: "greenFlag" },
        statements: [
          { type: "callProcedure", procedureId: "shared-1" },
          { type: "callProcedure", procedureId: "local-1" },
        ],
        procedures: [{ id: "local-1", name: "Salto", body: [{ type: "turn", degrees: 90 }] }],
      },
    ],
  };

  it("are written once, before the scripts, by every code view, with their own mapping", () => {
    const python = projectPython(withOwn);
    expect(python.text).toContain("def my_salto():");
    expect(python.text).toContain("def my_salto_2():");
    expect(python.text.indexOf("def my_salto():")).toBeLessThan(
      python.text.indexOf("def my_salto_2():"),
    );
    const agorix = projectAgorixCode(withOwn);
    expect(agorix.text).toContain("define shared Salto");
    expect(agorix.text.indexOf("define shared Salto")).toBeLessThan(
      agorix.text.indexOf("define Salto"),
    );
    const java = projectJava(withOwn);
    expect(java.text).toContain("void mySalto()");
    expect(java.text).toContain("void mySalto1()");
    const typescript = projectProgramLanguage(withOwn);
    expect(typescript.text).toContain("function my_salto()");
    expect(typescript.text).toContain("function my_salto_2()");
    for (const view of [python, agorix, java, typescript])
      expect(Object.keys(view.mapping)).toContain("sharedProcedures[0]");
  });
});
