import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "./schema.js";
import type { ProgramValidationErrorCode } from "./validate.js";
import { ProgramValidationError, validateProgram } from "./validate.js";
import { MAX_NESTING_DEPTH, MAX_PROGRAM_NODES } from "./limits.js";

// Table-driven positive and negative cases (issue #13 "Tests" section).
// Each negative case names the exact stable code it must produce (R7),
// so a regression that changes the wrong error kind is caught, not just
// "it throws something."

function deeplyNestedRepeat(depth: number): unknown {
  let innermost: unknown = { type: "move", steps: 1 };
  for (let i = 0; i < depth; i += 1) {
    innermost = { type: "repeat", count: 1, body: [innermost] };
  }
  return innermost;
}

function programWithStatements(statements: unknown[]): unknown {
  return {
    schema: SCHEMA_VERSION,
    scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
  };
}

describe("validateProgram — positive cases (R1)", () => {
  const validPrograms: Record<string, unknown> = {
    "single move at the steps boundary": programWithStatements([{ type: "move", steps: 1000 }]),
    "single turn at the negative degrees boundary": programWithStatements([
      { type: "turn", degrees: -1000 },
    ]),
    "repeat at the count boundary": programWithStatements([
      { type: "repeat", count: 1000, body: [{ type: "move", steps: 1 }] },
    ]),
    "nesting exactly at the depth limit": programWithStatements([deeplyNestedRepeat(MAX_NESTING_DEPTH - 1)]),
    "numeric literal at the upper bound": programWithStatements([
      { type: "if", condition: { type: "numericLiteral", value: 1_000_000 }, then: [] },
    ]),
    "two scripts with distinct ids": {
      schema: SCHEMA_VERSION,
      scripts: [
        { id: "a", trigger: { type: "onStart" }, statements: [] },
        { id: "b", trigger: { type: "onStart" }, statements: [] },
      ],
    },
  };

  it.each(Object.entries(validPrograms))("accepts: %s", (_name, program) => {
    expect(() => validateProgram(program)).not.toThrow();
  });
});

describe("validateProgram — negative cases by stable code (R2-R5, R7)", () => {
  const invalidPrograms: Record<string, [unknown, ProgramValidationErrorCode]> = {
    "non-object root": [null, "INVALID_ROOT"],
    "unknown schema version": [{ schema: "agorix/program/v2", scripts: [] }, "INVALID_SCHEMA_VERSION"],
    "duplicate script ids": [
      {
        schema: SCHEMA_VERSION,
        scripts: [
          { id: "same", trigger: { type: "onStart" }, statements: [] },
          { id: "same", trigger: { type: "onStart" }, statements: [] },
        ],
      },
      "DUPLICATE_ID",
    ],
    "unknown trigger type": [
      { schema: SCHEMA_VERSION, scripts: [{ id: "a", trigger: { type: "onCollision" }, statements: [] }] },
      "UNKNOWN_TRIGGER_TYPE",
    ],
    "unknown statement type": [
      programWithStatements([{ type: "teleport" }]),
      "UNKNOWN_STATEMENT_TYPE",
    ],
    "unknown expression type": [
      programWithStatements([{ type: "if", condition: { type: "randomChance" }, then: [] }]),
      "UNKNOWN_EXPRESSION_TYPE",
    ],
    "missing required field": [programWithStatements([{ type: "move" }]), "MISSING_FIELD"],
    "move.steps above the upper bound": [
      programWithStatements([{ type: "move", steps: 1001 }]),
      "NUMERIC_OUT_OF_BOUNDS",
    ],
    "move.steps below the lower bound": [
      programWithStatements([{ type: "move", steps: -1001 }]),
      "NUMERIC_OUT_OF_BOUNDS",
    ],
    "turn.degrees above the upper bound": [
      programWithStatements([{ type: "turn", degrees: 1001 }]),
      "NUMERIC_OUT_OF_BOUNDS",
    ],
    "repeat.count of zero (below the minimum of 1)": [
      programWithStatements([{ type: "repeat", count: 0, body: [] }]),
      "NUMERIC_OUT_OF_BOUNDS",
    ],
    "repeat.count above the upper bound": [
      programWithStatements([{ type: "repeat", count: 1001, body: [] }]),
      "NUMERIC_OUT_OF_BOUNDS",
    ],
    "numericLiteral.value above the upper bound": [
      programWithStatements([
        { type: "if", condition: { type: "numericLiteral", value: 1_000_001 }, then: [] },
      ]),
      "NUMERIC_OUT_OF_BOUNDS",
    ],
    "nesting one level past the depth limit": [
      programWithStatements([deeplyNestedRepeat(MAX_NESTING_DEPTH)]),
      "NESTING_TOO_DEEP",
    ],
    "program exceeding the max node count": [
      programWithStatements(
        Array.from({ length: MAX_PROGRAM_NODES + 1 }, () => ({ type: "move", steps: 1 })),
      ),
      "PROGRAM_TOO_LARGE",
    ],
  };

  it.each(Object.entries(invalidPrograms))("rejects: %s (code=%s)", (_name, [program, expectedCode]) => {
    let caught: unknown;
    try {
      validateProgram(program);
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(ProgramValidationError);
    expect((caught as ProgramValidationError).code).toBe(expectedCode);
  });
});

describe("validateProgram — no partial execution after failure (R6)", () => {
  it("throws rather than returning a partially-validated program", () => {
    const input = programWithStatements([
      { type: "move", steps: 1 },
      { type: "unknownFutureOp" },
    ]);
    let result: unknown;
    let threw = false;
    try {
      result = validateProgram(input);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
    expect(result).toBeUndefined();
  });
});
