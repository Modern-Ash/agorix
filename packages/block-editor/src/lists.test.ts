import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { applyWorkspaceChange, programToWorkspace, workspaceToProgram } from "./index.js";

describe("list blocks (issue #468)", () => {
  it("renames lists without changing references and refuses deletion while referenced", () => {
    const program: ProjectProgram = {
      schema: SCHEMA_VERSION,
      lists: [{ id: "l", name: "items", initialItems: [1], visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            { type: "listAdd", listId: "l", value: { type: "listLength", listId: "l" } },
          ],
        },
      ],
    };
    const workspace = programToWorkspace(program).workspace;
    const renamed = applyWorkspaceChange(workspace, {
      type: "renameList",
      listId: "l",
      name: "inventory",
    });
    expect(renamed.program.lists?.[0]).toMatchObject({ id: "l", name: "inventory" });
    expect(renamed.program.scripts[0]?.statements).toEqual(program.scripts[0]?.statements);
    expect(() =>
      applyWorkspaceChange(renamed.workspace, { type: "deleteList", listId: "l" }),
    ).toThrow();
    expect(workspace.lists?.[0]?.name).toBe("items");
  });

  it("deletes an unused list and rejects missing declarations", () => {
    const workspace = programToWorkspace({
      schema: SCHEMA_VERSION,
      lists: [{ id: "l", name: "items", initialItems: [], visible: true }],
      scripts: [],
    }).workspace;
    expect(
      applyWorkspaceChange(workspace, { type: "deleteList", listId: "l" }).program.lists,
    ).toEqual([]);
    expect(() =>
      applyWorkspaceChange(workspace, { type: "deleteList", listId: "missing" }),
    ).toThrow();
  });
  it("round-trips declarations, statements and expressions", () => {
    const original: ProjectProgram = {
      schema: SCHEMA_VERSION,
      lists: [{ id: "l", name: "items", initialItems: [1, 2], visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            { type: "listAdd", listId: "l", value: { type: "listLength", listId: "l" } },
            {
              type: "listRemoveAt",
              listId: "l",
              index: { type: "listItem", listId: "l", index: { type: "numericLiteral", value: 1 } },
            },
            {
              type: "listInsertAt",
              listId: "l",
              index: { type: "numericLiteral", value: 2 },
              value: { type: "numericLiteral", value: 7 },
            },
            {
              type: "listReplaceAt",
              listId: "l",
              index: { type: "numericLiteral", value: 1 },
              value: { type: "numericLiteral", value: 8 },
            },
          ],
        },
      ],
    };
    expect(workspaceToProgram(programToWorkspace(original).workspace).program).toEqual(original);
  });
});
