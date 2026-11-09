import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, TEXT_VALUE_MAX_LENGTH } from "./index.js";
import { ProgramValidationError, validateProgram } from "./validate.js";

const program = (statements: unknown[], textVariables: unknown[] = [word("hola")]) => ({
  schema: SCHEMA_VERSION,
  textVariables,
  scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
});
const word = (initialValue: string) => ({ id: "w", name: "palabra", initialValue, visible: false });

describe("text values", () => {
  it("accepts a text variable, setText and the text expressions", () => {
    const statements = [
      { type: "setText", variableId: "w", value: { type: "textLiteral", value: "sol" } },
      {
        type: "say",
        text: "hola",
        append: {
          type: "join",
          left: { type: "textVariable", variableId: "w" },
          right: { type: "textLength", value: { type: "textLiteral", value: "luna" } },
        },
      },
      {
        type: "if",
        condition: {
          type: "textContains",
          text: { type: "textVariable", variableId: "w" },
          part: {
            type: "letterOf",
            index: { type: "numericLiteral", value: 1 },
            value: { type: "textLiteral", value: "sol" },
          },
        },
        then: [{ type: "show" }],
      },
    ];
    expect(validateProgram(program(statements)).scripts[0]?.statements).toHaveLength(3);
  });
  it.each([
    [
      "an unknown text variable",
      [{ type: "setText", variableId: "nope", value: { type: "textLiteral", value: "a" } }],
    ],
    [
      "a text that is too long",
      [
        {
          type: "setText",
          variableId: "w",
          value: { type: "textLiteral", value: "x".repeat(TEXT_VALUE_MAX_LENGTH + 1) },
        },
      ],
    ],
    [
      "a text that is not a string",
      [{ type: "setText", variableId: "w", value: { type: "textLiteral", value: 4 } }],
    ],
  ])("rejects %s", (_name, statements) => {
    expect(() => validateProgram(program(statements))).toThrow(ProgramValidationError);
  });
  it("rejects a long initial value and a number variable used as a text variable", () => {
    expect(() =>
      validateProgram(program([], [word("x".repeat(TEXT_VALUE_MAX_LENGTH + 1))])),
    ).toThrow(ProgramValidationError);
    expect(() =>
      validateProgram({
        schema: SCHEMA_VERSION,
        variables: [{ id: "n", name: "n", initialValue: 0, visible: false }],
        scripts: [
          {
            id: "main",
            trigger: { type: "onStart" },
            statements: [
              { type: "setText", variableId: "n", value: { type: "textLiteral", value: "a" } },
            ],
          },
        ],
      }),
    ).toThrow(ProgramValidationError);
  });
});
