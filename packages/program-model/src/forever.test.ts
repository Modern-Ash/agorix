import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "./schema.js";
import { ProgramValidationError, validateProgram } from "./validate.js";

const program = (statements: unknown[]) => ({
  schema: SCHEMA_VERSION,
  scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
});
const forever = (body: unknown[]) => ({ type: "forever", body });
const move = { type: "move", steps: 1 };

describe("forever placement", () => {
  it("accepts one loop with one to three blocks", () => {
    expect(
      validateProgram(program([forever([move, move, move])])).scripts[0]?.statements[0],
    ).toEqual(forever([move, move, move]));
  });
  it.each([{ body: [] }, { body: [move, move, move, move] }])(
    "rejects an invalid body size",
    ({ body }) => {
      expect(() => validateProgram(program([forever(body)]))).toThrow(ProgramValidationError);
    },
  );
  it("rejects two forever blocks in a script", () => {
    expect(() => validateProgram(program([forever([move]), forever([move])]))).toThrow(
      ProgramValidationError,
    );
  });
  it("rejects forever inside another loop, including through an if branch", () => {
    expect(() =>
      validateProgram(
        program([
          {
            type: "repeat",
            count: 2,
            body: [
              {
                type: "if",
                condition: { type: "booleanLiteral", value: true },
                then: [forever([move])],
              },
            ],
          },
        ]),
      ),
    ).toThrow(ProgramValidationError);
  });
  it("accepts one forever in each separate script", () => {
    const input = program([forever([move])]);
    input.scripts.push({
      id: "second",
      trigger: { type: "onStart" },
      statements: [forever([move])],
    });
    expect(validateProgram(input).scripts).toHaveLength(2);
  });
});
