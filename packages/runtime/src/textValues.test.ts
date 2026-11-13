import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  type Expression,
  type ProjectProgram,
  type Statement,
} from "@agorix/program-model";
import { createWorldState, runProgram as run } from "./index.js";

const runProgram = (program: ProjectProgram) => run(program, createWorldState());

const text = (value: string): Expression => ({ type: "textLiteral", value });
const program = (statements: Statement[], initialValue = ""): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  textVariables: [{ id: "word", name: "word", initialValue, visible: false }],
  scripts: [{ id: "main", trigger: { type: "greenFlag" }, statements }],
});
const say = (append: Expression): Statement => ({ type: "say", text: "Dije:", append });

describe("text values", () => {
  it("keeps a word in a text variable and starts from its initial value", () => {
    expect(runProgram(program([], "hola")).world.texts?.["word"]?.value).toBe("hola");
    const run = runProgram(program([{ type: "setText", variableId: "word", value: text("luna") }]));
    expect(run.world.texts?.["word"]?.value).toBe("luna");
  });
  it("joins words and numbers, and says them", () => {
    const run = runProgram(
      program([
        { type: "setText", variableId: "word", value: text("gato") },
        say({
          type: "join",
          left: { type: "textVariable", variableId: "word" },
          right: { type: "numericLiteral", value: 3 },
        }),
      ]),
    );
    expect(run.world.sprite.bubble?.text).toBe("Dije: gato3");
  });
  it("cuts a joined text at the allowed length instead of failing", () => {
    const long = "a".repeat(40);
    const run = runProgram(
      program([
        {
          type: "setText",
          variableId: "word",
          value: { type: "join", left: text(long), right: text(long) },
        },
      ]),
    );
    expect(run.world.texts?.["word"]?.value).toHaveLength(40);
  });
  it("answers length, letter of and contains from the text", () => {
    const check = (value: Expression) =>
      runProgram(program([say(value)])).world.sprite.bubble?.text;
    expect(check({ type: "textLength", value: text("sol") })).toBe("Dije: 3");
    expect(
      check({ type: "letterOf", index: { type: "numericLiteral", value: 2 }, value: text("sol") }),
    ).toBe("Dije: o");
    expect(
      check({ type: "letterOf", index: { type: "numericLiteral", value: 9 }, value: text("sol") }),
    ).toBe("Dije: ");
    expect(check({ type: "textContains", text: text("Mariposa"), part: text("POS") })).toBe(
      "Dije: true",
    );
  });
  it("compares words ignoring upper and lower case", () => {
    const run = runProgram(
      program([
        {
          type: "if",
          condition: { type: "equals", left: text("Sol"), right: text("sOL") },
          then: [{ type: "move", steps: 10 }],
        },
      ]),
    );
    expect(run.world.sprite.x).toBe(10);
  });
  it.each([
    { left: "007", right: "7", expected: true },
    { left: "1.00", right: "1", expected: true },
    { left: " ", right: "0", expected: false },
    { left: "", right: "0", expected: false },
    { left: "apple", right: "APPLE", expected: true },
    { left: "apple", right: "pear", expected: false },
  ])("compares Scratch text '$left' and '$right' for equality", ({ left, right, expected }) => {
    const result = runProgram(
      program([
        {
          type: "if",
          condition: { type: "equals", left: text(left), right: text(right) },
          then: [{ type: "move", steps: 10 }],
        },
      ]),
    );
    expect(result.world.sprite.x).toBe(expected ? 10 : 0);
  });
  it.each([
    { type: "lessThan", left: text("apple"), right: text("Banana"), expected: true },
    { type: "greaterThan", left: text("Zebra"), right: text("apple"), expected: true },
    { type: "lessThan", left: text("10"), right: text("2"), expected: false },
    { type: "greaterThan", left: text("10"), right: text("2"), expected: true },
    {
      type: "lessThan",
      left: { type: "numericLiteral", value: 2 } as Expression,
      right: text("apple"),
      expected: true,
    },
    { type: "lessThan", left: text(" "), right: text("a"), expected: true },
  ] as const)(
    "orders $type operands using Scratch comparison",
    ({ type, left, right, expected }) => {
      const result = runProgram(
        program([
          { type: "if", condition: { type, left, right }, then: [{ type: "move", steps: 10 }] },
        ]),
      );
      expect(result.world.sprite.x).toBe(expected ? 10 : 0);
    },
  );
  it.each([
    { word: "12", number: 12, expected: true },
    { word: "13", number: 12, expected: false },
    { word: "hola", number: 0, expected: false },
    { word: "", number: 0, expected: false },
  ])(
    "compares a word '$word' and number $number only when the word is numeric",
    ({ word, number, expected }) => {
      for (const [left, right] of [
        [text(word), { type: "numericLiteral", value: number } as Expression],
        [{ type: "numericLiteral", value: number } as Expression, text(word)],
      ]) {
        const result = runProgram(
          program([
            {
              type: "if",
              condition: { type: "equals", left: left!, right: right! },
              then: [{ type: "move", steps: 10 }],
            },
          ]),
        );
        expect(result.world.sprite.x).toBe(expected ? 10 : 0);
      }
    },
  );
});
