import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram } from "./schema.js";
import { ProgramValidationError, validateProgram } from "./validate.js";
import { MAX_NESTING_DEPTH } from "./limits.js";

// Issue #463: `else` is optional and additive.
const program = (statements: ProjectProgram["scripts"][number]["statements"]): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
});
const cond = { type: "touchingGoal" } as const;

describe("if / else validation (issue #463)", () => {
  it("keeps programs without else byte-identical", () => {
    const old = program([{ type: "if", condition: cond, then: [{ type: "move", steps: 1 }] }]);
    const validated = validateProgram(old);
    expect(validated).toEqual(old);
    expect(JSON.stringify(validated)).not.toContain("else");
  });

  it("accepts an else branch, including an empty one, and validates its statements", () => {
    const withElse = program([
      { type: "if", condition: cond, then: [], else: [{ type: "move", steps: 2 }] },
      { type: "if", condition: cond, then: [], else: [] },
    ]);
    expect(validateProgram(withElse)).toEqual(withElse);
    expect(() =>
      validateProgram(
        program([{ type: "if", condition: cond, then: [], else: [{ type: "nope" }] }] as never),
      ),
    ).toThrow(ProgramValidationError);
    expect(() =>
      validateProgram(program([{ type: "if", condition: cond, then: [], else: "x" }] as never)),
    ).toThrow(ProgramValidationError);
  });

  it("enforces the nesting limit inside else", () => {
    let body: unknown[] = [{ type: "move", steps: 1 }];
    for (let level = 0; level < MAX_NESTING_DEPTH + 1; level++) {
      body = [{ type: "if", condition: cond, then: [], else: body }];
    }
    expect(() => validateProgram(program(body as never))).toThrow(ProgramValidationError);
  });
});
