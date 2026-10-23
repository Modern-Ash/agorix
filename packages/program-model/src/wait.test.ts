import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "./schema.js";
import { ProgramValidationError, validateProgram } from "./validate.js";

// Issue #466
const program = (statement: unknown): ProjectProgram =>
  ({
    schema: SCHEMA_VERSION,
    scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [statement] }],
  }) as ProjectProgram;

describe("wait validation (issue #466)", () => {
  it("accepts 0.1 to 5 seconds, ends included", () => {
    for (const seconds of [0.1, 1, 5]) {
      const ok = program({ type: "wait", seconds });
      expect(validateProgram(ok)).toEqual(ok);
    }
  });

  it("rejects out-of-range, non-numeric and missing seconds", () => {
    for (const seconds of [0, 0.05, 5.1, -1, Number.NaN, Number.POSITIVE_INFINITY, "1", null]) {
      expect(() => validateProgram(program({ type: "wait", seconds }))).toThrow(
        ProgramValidationError,
      );
    }
    expect(() => validateProgram(program({ type: "wait" }))).toThrow(ProgramValidationError);
  });
});
