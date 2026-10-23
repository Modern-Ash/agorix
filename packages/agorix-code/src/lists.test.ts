import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { projectAgorixCode } from "./index.js";

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
    const text = projectAgorixCode(program).text;
    for (const part of [
      'list "Items" = 4, 5',
      'show "Items"',
      'add 6 to "Items"',
      'remove item 1 of "Items"',
      'item 1 of "Items"',
      'length of "Items"',
    ])
      expect(text).toContain(part);
  });
});
