import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  type Expression,
  type ProjectProgram,
  type Statement,
} from "@agorix/program-model";
import { createWorldState, runMultiActorProgram, runProgram } from "./index.js";

// Issue #468: lists of numbers, capped, never throwing on a bad index.
const num = (value: number): Expression => ({ type: "numericLiteral", value });
const program = (
  statements: Statement[],
  items: number[] = [],
  visible = true,
): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  variables: [{ id: "r", name: "r", initialValue: 0, visible: false }],
  lists: [{ id: "l", name: "items", initialItems: items, visible }],
  scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
});
const store = (value: Expression): Statement => ({ type: "setVariable", variableId: "r", value });
const run = (statements: Statement[], items?: number[]) =>
  runProgram(program(statements, items), createWorldState());

describe("lists (issue #468)", () => {
  it("seeds the declared items and visibility into the world", () => {
    const result = run([], [4, 5]);
    expect(result.world.lists).toEqual({ l: { items: [4, 5], visible: true } });
  });

  it("add appends, length counts, item reads 1-based", () => {
    const result = run(
      [
        { type: "listAdd", listId: "l", value: num(7) },
        { type: "listAdd", listId: "l", value: num(8) },
        store({ type: "listItem", listId: "l", index: num(2) }),
      ],
      [1],
    );
    expect(result.world.lists?.["l"]?.items).toEqual([1, 7, 8]);
    expect(result.world.variables?.["r"]?.value).toBe(7);
    const length = run([store({ type: "listLength", listId: "l" })], [3, 4, 5]);
    expect(length.world.variables?.["r"]?.value).toBe(3);
    expect(run([store({ type: "listLength", listId: "l" })]).world.variables?.["r"]?.value).toBe(0);
  });

  it("remove at deletes that position and shifts the rest", () => {
    const result = run([{ type: "listRemoveAt", listId: "l", index: num(2) }], [10, 20, 30]);
    expect(result.world.lists?.["l"]?.items).toEqual([10, 30]);
  });

  it("an out-of-range index reads 0 or does nothing, records a note and never throws", () => {
    for (const index of [0, -1, 4, 99, 999_999, -999_999]) {
      const read = run([store({ type: "listItem", listId: "l", index: num(index) })], [1, 2, 3]);
      expect(read.outcome).toBe("completed");
      expect(read.world.variables?.["r"]?.value).toBe(0);
      expect(read.notes?.[0]).toContain("list-index-out-of-range");
      const remove = run([{ type: "listRemoveAt", listId: "l", index: num(index) }], [1, 2, 3]);
      expect(remove.world.lists?.["l"]?.items).toEqual([1, 2, 3]);
      expect(remove.notes?.[0]).toContain("list-index-out-of-range");
    }
    expect(run([store({ type: "listItem", listId: "l", index: num(1) })]).notes).toHaveLength(1);
    expect(run([], [1]).notes).toBeUndefined();
  });

  it("a fractional index truncates toward its whole part", () => {
    const result = run([store({ type: "listItem", listId: "l", index: num(2.9) })], [5, 6, 7]);
    expect(result.world.variables?.["r"]?.value).toBe(6);
  });

  it("is capped at 100 items: adds past the cap are ignored with a note", () => {
    const full = Array.from({ length: 100 }, (_, i) => i);
    const result = run([{ type: "listAdd", listId: "l", value: num(1) }], full);
    expect(result.world.lists?.["l"]?.items).toHaveLength(100);
    expect(result.notes?.[0]).toContain("list-full");
    const grown = run([
      { type: "repeat", count: 150, body: [{ type: "listAdd", listId: "l", value: num(1) }] },
    ]);
    expect(grown.world.lists?.["l"]?.items).toHaveLength(100);
    expect((grown.notes ?? []).length).toBeLessThanOrEqual(20);
  });

  it("works with expressions as arguments and inside multi-actor runs", () => {
    const result = run(
      [
        { type: "listAdd", listId: "l", value: { type: "add", left: num(2), right: num(3) } },
        store({ type: "listItem", listId: "l", index: { type: "listLength", listId: "l" } }),
      ],
      [9],
    );
    expect(result.world.variables?.["r"]?.value).toBe(5);
    const multi = runMultiActorProgram(
      program([{ type: "listAdd", listId: "l", value: num(1) }], [0]),
    );
    expect(multi.actors[0]?.world.lists?.["l"]?.items).toEqual([0, 1]);
  });

  it("leaves programs without lists byte-identical (no lists, no notes)", () => {
    const plain = runProgram(
      {
        schema: SCHEMA_VERSION,
        scripts: [
          { id: "m", trigger: { type: "onStart" }, statements: [{ type: "move", steps: 1 }] },
        ],
      },
      createWorldState(),
    );
    expect("lists" in plain.world).toBe(false);
    expect("notes" in plain).toBe(false);
  });
});
