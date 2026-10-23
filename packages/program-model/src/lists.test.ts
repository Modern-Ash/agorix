import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "./schema.js";
import { ProgramValidationError, validateProgram } from "./validate.js";

// Issue #468
const base = (extra: Record<string, unknown>, statements: unknown[] = []): unknown => ({
  schema: SCHEMA_VERSION,
  ...extra,
  scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
});
const list = { id: "l", name: "items", initialItems: [1, 2], visible: true };

describe("list validation (issue #468)", () => {
  it("accepts declared lists and list statements/expressions", () => {
    const ok = base({ lists: [list] }, [
      { type: "listAdd", listId: "l", value: { type: "numericLiteral", value: 3 } },
      { type: "listRemoveAt", listId: "l", index: { type: "listLength", listId: "l" } },
      {
        type: "listAdd",
        listId: "l",
        value: { type: "listItem", listId: "l", index: { type: "numericLiteral", value: 1 } },
      },
    ]);
    expect(validateProgram(ok)).toEqual(ok);
  });

  it("keeps programs without lists unchanged (no lists key)", () => {
    expect("lists" in validateProgram(base({}))).toBe(false);
  });

  it("rejects unknown list ids, duplicate ids and bad declarations", () => {
    const bad: unknown[] = [
      base({}, [{ type: "listAdd", listId: "nope", value: { type: "numericLiteral", value: 1 } }]),
      base({ lists: [list, list] }),
      base({ lists: [{ ...list, initialItems: ["x"] }] }),
      base({ lists: [{ ...list, initialItems: [Number.NaN] }] }),
      base({ lists: [{ ...list, initialItems: [2_000_000] }] }),
      base({ lists: [{ ...list, initialItems: Array.from({ length: 101 }, () => 1) }] }),
      base({ lists: [{ ...list, visible: "yes" }] }),
      base({ lists: [{ ...list, name: "" }] }),
      base({ lists: "no" }),
    ];
    for (const input of bad) expect(() => validateProgram(input)).toThrow(ProgramValidationError);
  });

  it("allows exactly 100 initial items", () => {
    const full = base({ lists: [{ ...list, initialItems: Array.from({ length: 100 }, () => 1) }] });
    expect((validateProgram(full) as ProjectProgram).lists?.[0]?.initialItems).toHaveLength(100);
  });

  it("a list id cannot reuse a variable id", () => {
    expect(() =>
      validateProgram(
        base({
          variables: [{ id: "l", name: "v", initialValue: 0, visible: false }],
          lists: [list],
        }),
      ),
    ).toThrow(ProgramValidationError);
  });
});
