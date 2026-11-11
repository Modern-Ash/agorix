import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { programToWorkspace, workspaceToProgram } from "./index.js";

describe("list blocks (issue #468)", () => {
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

  it("round-trips a list that holds numbers and words (the starting items and words in blocks)", () => {
    const original: ProjectProgram = {
      schema: SCHEMA_VERSION,
      textVariables: [{ id: "t", name: "t", initialValue: "", visible: false }],
      lists: [{ id: "l", name: "items", initialItems: [1, "hola", "3", ""], visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            { type: "listAdd", listId: "l", value: { type: "textLiteral", value: "uno" } },
            {
              type: "listInsertAt",
              listId: "l",
              index: { type: "numericLiteral", value: 2 },
              value: { type: "textVariable", variableId: "t" },
            },
            {
              type: "listReplaceAt",
              listId: "l",
              index: { type: "numericLiteral", value: 1 },
              value: { type: "textLiteral", value: "dos" },
            },
            {
              type: "setText",
              variableId: "t",
              value: {
                type: "listItem",
                listId: "l",
                index: { type: "numericLiteral", value: 2 },
              },
            },
          ],
        },
      ],
    };
    expect(workspaceToProgram(programToWorkspace(original).workspace).program).toEqual(original);
  });
});
