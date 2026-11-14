import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { programToWorkspace, workspaceToProgram } from "./index.js";

describe("list blocks (issue #468)", () => {
  it("round-trips a numeric variable used as a list index", () => {
    const original: ProjectProgram = {
      schema: SCHEMA_VERSION,
      variables: [{ id: "position", name: "position", initialValue: 2, visible: false }],
      textVariables: [{ id: "word", name: "word", initialValue: "2", visible: false }],
      lists: [{ id: "l", name: "items", initialItems: ["A", "B"], visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "listRemoveAt",
              listId: "l",
              index: { type: "variable", variableId: "position" },
            },
            {
              type: "listRemoveAt",
              listId: "l",
              index: { type: "textVariable", variableId: "word" },
            },
            {
              type: "listRemoveAt",
              listId: "l",
              index: {
                type: "add",
                left: { type: "variable", variableId: "position" },
                right: { type: "numericLiteral", value: 1 },
              },
            },
            {
              type: "listRemoveAt",
              listId: "l",
              index: {
                type: "mathFunction",
                function: "round",
                value: { type: "variable", variableId: "position" },
              },
            },
            {
              type: "listRemoveAt",
              listId: "l",
              index: { type: "textLength", value: { type: "textVariable", variableId: "word" } },
            },
            {
              type: "listRemoveAt",
              listId: "l",
              index: {
                type: "letterOf",
                index: { type: "numericLiteral", value: 1 },
                value: { type: "textVariable", variableId: "word" },
              },
            },
            { type: "listRemoveAt", listId: "l", index: { type: "costumeNumber" } },
            { type: "listRemoveAt", listId: "l", index: { type: "backdropNumber" } },
            {
              type: "listRemoveAt",
              listId: "l",
              index: {
                type: "actorProperty",
                actorId: "actor:studio-1-nova",
                property: "xPosition",
              },
            },
            {
              type: "listRemoveAt",
              listId: "l",
              index: {
                type: "listIndexOf",
                listId: "l",
                value: { type: "variable", variableId: "position" },
              },
            },
            {
              type: "listRemoveAt",
              listId: "l",
              index: {
                type: "listIndexOf",
                listId: "l",
                value: { type: "listLength", listId: "l" },
              },
            },
            {
              type: "listInsertAt",
              listId: "l",
              index: { type: "variable", variableId: "position" },
              value: { type: "textLiteral", value: "C" },
            },
            {
              type: "listReplaceAt",
              listId: "l",
              index: { type: "variable", variableId: "position" },
              value: { type: "textLiteral", value: "D" },
            },
          ],
        },
      ],
    };
    expect(workspaceToProgram(programToWorkspace(original).workspace).program).toEqual(original);
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
            { type: "showList", listId: "l" },
            { type: "hideList", listId: "l" },
            { type: "listClear", listId: "l" },
            {
              type: "listAdd",
              listId: "l",
              value: {
                type: "listIndexOf",
                listId: "l",
                value: { type: "numericLiteral", value: 1 },
              },
            },
            {
              type: "if",
              condition: {
                type: "listContains",
                listId: "l",
                value: { type: "numericLiteral", value: 2 },
              },
              then: [{ type: "showList", listId: "l" }],
            },
            {
              type: "listRemoveAt",
              listId: "l",
              index: { type: "listItem", listId: "l", index: { type: "numericLiteral", value: 1 } },
            },
            {
              type: "listRemoveAt",
              listId: "l",
              index: {
                type: "listIndexOf",
                listId: "l",
                value: { type: "textLiteral", value: "A" },
              },
            },
            {
              type: "listRemoveAt",
              listId: "l",
              index: {
                type: "listIndexOf",
                listId: "l",
                value: {
                  type: "listItem",
                  listId: "l",
                  index: { type: "numericLiteral", value: 1 },
                },
              },
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
