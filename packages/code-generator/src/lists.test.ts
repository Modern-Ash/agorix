import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { projectProgram } from "./project.js";

// Issue #468
const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  variables: [{ id: "r", name: "r", initialValue: 0, visible: false }],
  lists: [{ id: "l", name: "Items", initialItems: [4, 5], visible: true }],
  scripts: [
    {
      id: "main",
      trigger: { type: "onStart" },
      statements: [
        { type: "listAdd", listId: "l", value: { type: "numericLiteral", value: 6 } },
        { type: "listRemoveAt", listId: "l", index: { type: "numericLiteral", value: 1 } },
        {
          type: "listInsertAt",
          listId: "l",
          index: { type: "numericLiteral", value: 2 },
          value: { type: "numericLiteral", value: 9 },
        },
        {
          type: "listReplaceAt",
          listId: "l",
          index: { type: "numericLiteral", value: 1 },
          value: { type: "numericLiteral", value: 8 },
        },
        {
          type: "setVariable",
          variableId: "r",
          value: {
            type: "add",
            left: { type: "listItem", listId: "l", index: { type: "numericLiteral", value: 1 } },
            right: { type: "listLength", listId: "l" },
          },
        },
      ],
    },
  ],
};

describe("list projection (issue #468)", () => {
  it("declares the list and writes every list operation", () => {
    const text = projectProgram(program).code;
    for (const part of [
      "const items = [4, 5];",
      'showList("Items");',
      "listAdd(items, 6);",
      "listRemoveAt(items, 1);",
      "listInsertAt(items, 2, 9);",
      "listReplaceAt(items, 1, 8);",
      "listItem(items, 1)",
      "items.length",
    ])
      expect(text).toContain(part);
  });
});
