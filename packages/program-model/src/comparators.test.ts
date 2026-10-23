import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "./schema.js";
import { ProgramValidationError, validateProgram } from "./validate.js";

// Issue #464
const program = (condition: unknown): ProjectProgram =>
  ({
    schema: SCHEMA_VERSION,
    scripts: [
      {
        id: "main",
        trigger: { type: "onStart" },
        statements: [{ type: "if", condition, then: [] }],
      },
    ],
  }) as ProjectProgram;
const one = { type: "numericLiteral", value: 1 };

describe("lessOrEqual / greaterOrEqual validation (issue #464)", () => {
  for (const type of ["lessOrEqual", "greaterOrEqual"]) {
    it(`accepts ${type} and rejects a missing operand`, () => {
      const ok = program({ type, left: one, right: one });
      expect(validateProgram(ok)).toEqual(ok);
      expect(() => validateProgram(program({ type, left: one }))).toThrow(ProgramValidationError);
    });
  }
});
