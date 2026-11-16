import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "@agorix/program-model";
import { parseAgorixCode, projectAgorixCode } from "./index.js";

const n = (value: number) => ({ type: "numericLiteral", value }) as const;

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  variables: [{ id: "var-1", name: "r", initialValue: 0, visible: false }],
  lists: [
    { id: "list-1", name: "Items", initialItems: [4, "a, b", -2.5], visible: true },
    { id: "list-2", name: "Empty", initialItems: [], visible: false, scope: "stage" },
  ],
  scripts: [
    {
      id: "script-1",
      trigger: { type: "greenFlag" },
      statements: [
        { type: "listAdd", listId: "list-1", value: n(6) },
        { type: "listRemoveAt", listId: "list-1", index: n(1) },
        { type: "listInsertAt", listId: "list-1", index: n(2), value: n(9) },
        { type: "listReplaceAt", listId: "list-1", index: n(1), value: n(8) },
        { type: "listClear", listId: "list-2" },
        { type: "showList", listId: "list-2" },
        { type: "hideList", listId: "list-1" },
        {
          type: "setVariable",
          variableId: "var-1",
          value: {
            type: "add",
            left: { type: "listItem", listId: "list-1", index: n(1) },
            right: { type: "listLength", listId: "list-1" },
          },
        },
        {
          type: "if",
          condition: { type: "listContains", listId: "list-1", value: n(4) },
          then: [
            {
              type: "setVariable",
              variableId: "var-1",
              value: { type: "listIndexOf", listId: "list-1", value: n(4) },
            },
          ],
        },
      ],
    },
  ],
};

describe("Agorix Code reads lists", () => {
  it("gives the same program back, with and without the base", () => {
    const text = projectAgorixCode(program).text;
    for (const base of [program, undefined]) {
      const parsed = parseAgorixCode(text, base);
      expect(parsed).toEqual({ ok: true, program });
    }
  });

  it("refuses a list that is not declared", () => {
    const text = projectAgorixCode(program).text.replace(/^stage list "Empty".*\n/m, "");
    const parsed = parseAgorixCode(text, undefined);
    expect(parsed.ok).toBe(false);
  });
});
