import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "./schema.js";
import { ProgramValidationError, validateProgram } from "./validate.js";

const program = (statement: unknown) => ({
  schema: SCHEMA_VERSION,
  scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [statement] }],
});

describe("createCopies", () => {
  it.each(["spread", "fall", "follow"])("accepts rule %s", (rule) => {
    const statement = { type: "createCopies", count: 3, rule };
    expect(validateProgram(program(statement)).scripts[0]?.statements[0]).toEqual(statement);
  });
  it.each([
    { count: 0, rule: "spread" },
    { count: 11, rule: "spread" },
    { count: 2.5, rule: "spread" },
    { count: 3, rule: "teleport" },
    { count: 3 },
  ])("rejects %j", (fields) => {
    expect(() => validateProgram(program({ type: "createCopies", ...fields }))).toThrow(
      ProgramValidationError,
    );
  });
});
