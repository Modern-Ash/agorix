import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  type Expression,
  type ProjectProgram,
  type Statement,
} from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";

// Lists hold numbers or words, as in Scratch. One rule decides how one is used as the other.
const num = (value: number): Expression => ({ type: "numericLiteral", value });
const word = (value: string): Expression => ({ type: "textLiteral", value });
const item = (at: number): Expression => ({ type: "listItem", listId: "l", index: num(at) });

const program = (statements: Statement[], items: (number | string)[] = []): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  variables: [{ id: "r", name: "r", initialValue: 0, visible: false }],
  textVariables: [{ id: "t", name: "t", initialValue: "", visible: false }],
  lists: [{ id: "l", name: "items", initialItems: items, visible: true }],
  scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
});
const run = (statements: Statement[], items?: (number | string)[]) =>
  runProgram(program(statements, items), createWorldState());
const setR = (value: Expression): Statement => ({ type: "setVariable", variableId: "r", value });
const setT = (value: Expression): Statement => ({ type: "setText", variableId: "t", value });

describe("lists of numbers or words", () => {
  it("keeps a word as a word and a number as a number, in the order they were added", () => {
    const result = run([
      { type: "listAdd", listId: "l", value: word("hola") },
      { type: "listAdd", listId: "l", value: num(7) },
      { type: "listAdd", listId: "l", value: word("3") },
    ]);
    expect(result.world.lists?.["l"]?.items).toEqual(["hola", 7, "3"]);
  });

  it("seeds declared words, and insert and replace take a word too", () => {
    const result = run(
      [
        { type: "listInsertAt", listId: "l", index: num(1), value: word("uno") },
        { type: "listReplaceAt", listId: "l", index: num(3), value: word("tres") },
      ],
      ["b", 2],
    );
    expect(result.world.lists?.["l"]?.items).toEqual(["uno", "b", "tres"]);
  });

  it("reads an item back as a word, or as a number, by the one coercion rule", () => {
    const result = run([setT(item(1)), setR(item(2))], ["hola", "12"]);
    expect(result.world.texts?.["t"]?.value).toBe("hola");
    // "12" reads as 12 where a number is wanted.
    expect(result.world.variables?.["r"]?.value).toBe(12);
    // A word that is not a number is 0 where a number is wanted.
    expect(run([setR(item(1))], ["hola"]).world.variables?.["r"]?.value).toBe(0);
    // A number is its digits where a word is wanted.
    expect(run([setT(item(1))], [12]).world.texts?.["t"]?.value).toBe("12");
  });

  it("compares words ignoring capitals, and a word that reads as a number with that number", () => {
    expect(
      runProgram(
        program(
          [
            {
              type: "if",
              condition: { type: "equals", left: word("Hola"), right: item(1) },
              then: [setR(num(1))],
            },
          ],
          ["hOLA"],
        ),
        createWorldState(),
      ).world.variables?.["r"]?.value,
    ).toBe(1);
    expect(
      runProgram(
        program(
          [
            {
              type: "if",
              condition: { type: "equals", left: num(3), right: item(1) },
              then: [setR(num(1))],
            },
          ],
          ["3"],
        ),
        createWorldState(),
      ).world.variables?.["r"]?.value,
    ).toBe(1);
  });

  it("searches numeric-looking list words as Scratch numbers, but keeps blank words textual", () => {
    expect(
      run([setR({ type: "listIndexOf", listId: "l", value: word("7") })], ["007", "7"]).world
        .variables?.["r"]?.value,
    ).toBe(1);
    expect(
      run(
        [
          {
            type: "if",
            condition: { type: "listContains", listId: "l", value: num(0) },
            then: [setR(num(1))],
          },
        ],
        [" ", ""],
      ).world.variables?.["r"]?.value,
    ).toBe(0);
    expect(
      run([setR({ type: "listIndexOf", listId: "l", value: word("missing") })], ["007"]).world
        .variables?.["r"]?.value,
    ).toBe(0);
  });

  it("clips a long word, turns true and false into words, and never stops the run", () => {
    const long = run([
      { type: "listAdd", listId: "l", value: word("x".repeat(40)) },
      {
        type: "listAdd",
        listId: "l",
        value: { type: "join", left: word("y".repeat(40)), right: word("z".repeat(40)) },
      },
      {
        type: "listAdd",
        listId: "l",
        value: { type: "greaterThan", left: num(2), right: num(1) },
      },
    ]);
    const items = long.world.lists?.["l"]?.items as string[];
    expect(items[0]).toHaveLength(40);
    expect(items[1]).toHaveLength(40);
    expect(items[2]).toBe("true");
    expect(long.outcome).toBe("completed");
  });

  it("keeps the 100 item cap and a note when it is full, for words as for numbers", () => {
    const full = run(
      [{ type: "listAdd", listId: "l", value: word("uno más") }],
      Array.from({ length: 100 }, () => "a"),
    );
    expect(full.world.lists?.["l"]?.items).toHaveLength(100);
    expect(full.notes?.some((note) => note.startsWith("list-full:l"))).toBe(true);
  });

  it("leaves a list of numbers exactly as it was", () => {
    const result = run(
      [
        { type: "listAdd", listId: "l", value: num(7) },
        setR({ type: "add", left: item(1), right: item(2) }),
      ],
      [1],
    );
    expect(result.world.lists?.["l"]?.items).toEqual([1, 7]);
    expect(result.world.variables?.["r"]?.value).toBe(8);
  });

  it("never writes a word into the note a run leaves behind", () => {
    const result = run([{ type: "listRemoveAt", listId: "l", index: num(5) }], ["secreto"]);
    expect(JSON.stringify(result.notes ?? [])).not.toContain("secreto");
  });
});
