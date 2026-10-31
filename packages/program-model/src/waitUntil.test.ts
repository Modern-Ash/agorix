import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "./schema.js";
import { ProgramValidationError, validateProgram } from "./validate.js";

const program = (condition: unknown) => ({
  schema: SCHEMA_VERSION,
  scripts: [
    { id: "main", trigger: { type: "onStart" }, statements: [{ type: "waitUntil", condition }] },
  ],
});

describe("waitUntil validation", () => {
  it("preserves a two-level compound condition", () => {
    const condition = {
      type: "and",
      left: { type: "keyDown", key: "Space" },
      right: { type: "not", value: { type: "touchingGoal" } },
    };
    expect(validateProgram(program(condition)).scripts[0]?.statements[0]).toEqual({
      type: "waitUntil",
      condition,
    });
  });
  it.each([
    null,
    { type: "unknown" },
    { type: "and", left: { type: "booleanLiteral", value: true } },
  ])("rejects an invalid condition", (condition) =>
    expect(() => validateProgram(program(condition))).toThrow(ProgramValidationError),
  );
});
