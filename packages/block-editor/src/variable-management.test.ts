import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { applyWorkspaceChange, programToWorkspace } from "./index.js";

describe("variable management", () => {
  const variable = { id: "energy", name: "Energy", initialValue: 1, visible: true } as const;

  it("renames a referenced variable without changing its identifier", () => {
    const program: ProjectProgram = {
      schema: SCHEMA_VERSION,
      variables: [variable],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "setVariable",
              variableId: "energy",
              value: { type: "numericLiteral", value: 3 },
            },
          ],
        },
      ],
    };
    const workspace = programToWorkspace(program).workspace;
    const renamed = applyWorkspaceChange(workspace, {
      type: "renameVariable",
      variableId: "energy",
      name: "Power",
    });
    expect(renamed.program.variables?.[0]).toMatchObject({ id: "energy", name: "Power" });
    expect(renamed.program.scripts[0]?.statements).toEqual(program.scripts[0]?.statements);
    expect(() =>
      applyWorkspaceChange(renamed.workspace, { type: "deleteVariable", variableId: "energy" }),
    ).toThrow();
    expect(workspace.variables?.[0]?.name).toBe("Energy");
  });

  it("deletes only unused variables and rejects missing ids", () => {
    const workspace = programToWorkspace({
      schema: SCHEMA_VERSION,
      variables: [variable],
      scripts: [],
    }).workspace;
    expect(
      applyWorkspaceChange(workspace, { type: "deleteVariable", variableId: "energy" }).program
        .variables,
    ).toEqual([]);
    expect(() =>
      applyWorkspaceChange(workspace, { type: "deleteVariable", variableId: "missing" }),
    ).toThrow();
    expect(() =>
      applyWorkspaceChange(workspace, { type: "renameVariable", variableId: "energy", name: " " }),
    ).toThrow();
  });
});
