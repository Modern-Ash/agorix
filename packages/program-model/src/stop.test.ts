import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "./schema.js";
import { ProgramValidationError, validateProgram } from "./validate.js";

const program = (scope: unknown) => ({
  schema: SCHEMA_VERSION,
  scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [{ type: "stop", scope }] }],
});

describe("stop validation", () => {
  it.each(["script", "actor", "scene"])("accepts %s", (scope) => {
    expect(validateProgram(program(scope)).scripts[0]?.statements[0]).toEqual({
      type: "stop",
      scope,
    });
  });
  it.each(["all", "", null, 1])("rejects invalid scope %s", (scope) => {
    expect(() => validateProgram(program(scope))).toThrow(ProgramValidationError);
  });
});
