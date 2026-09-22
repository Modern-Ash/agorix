import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION } from "./schema.js";
import { ProgramValidationError, validateProgram } from "./validate.js";
import { DOCUMENTED_EXAMPLE_PROGRAM, FULL_COVERAGE_PROGRAM } from "./fixtures.js";

describe("validateProgram", () => {
  // R1 — the documented PROGRAMMING_MODEL.md example is valid.
  it("accepts the documented example program", () => {
    const result = validateProgram(DOCUMENTED_EXAMPLE_PROGRAM);
    expect(result).toEqual(DOCUMENTED_EXAMPLE_PROGRAM);
  });

  // R1 — the raw JSON from the docs, not just the typed fixture, must validate.
  it("accepts the documented example as raw JSON (not a typed object)", () => {
    const rawJson = JSON.parse(
      JSON.stringify({
        schema: "agorix/program/v1",
        scripts: [
          {
            id: "main",
            trigger: { type: "onStart" },
            statements: [
              {
                type: "repeat",
                count: 5,
                body: [{ type: "move", steps: 10 }],
              },
            ],
          },
        ],
      }),
    );
    expect(() => validateProgram(rawJson)).not.toThrow();
  });

  // R3 — round-trip preserves semantic (structural) equality.
  it("round-trips through JSON without semantic drift", () => {
    for (const fixture of [DOCUMENTED_EXAMPLE_PROGRAM, FULL_COVERAGE_PROGRAM]) {
      const validated = validateProgram(fixture);
      const roundTripped = JSON.parse(JSON.stringify(validated));
      expect(roundTripped).toEqual(validated);
      expect(validateProgram(roundTripped)).toEqual(validated);
    }
  });

  // R4 — unknown schema version is rejected, not silently upgraded/ignored.
  it("rejects an unknown schema version", () => {
    expect(() => validateProgram({ schema: "agorix/program/v2", scripts: [] })).toThrow(
      ProgramValidationError,
    );
  });

  // R4 — an unknown statement type cannot silently enter the model.
  it("rejects an unknown statement type", () => {
    const input = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "teleport", x: 0, y: 0 }],
        },
      ],
    };
    expect(() => validateProgram(input)).toThrow(ProgramValidationError);
    try {
      validateProgram(input);
    } catch (error) {
      expect(error).toBeInstanceOf(ProgramValidationError);
      expect((error as ProgramValidationError).path).toBe("$.scripts[0].statements[0].type");
    }
  });

  // R4 — an unknown expression type inside a condition is rejected.
  it("rejects an unknown expression type", () => {
    const input = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "if",
              condition: { type: "randomChance" },
              then: [],
            },
          ],
        },
      ],
    };
    expect(() => validateProgram(input)).toThrow(ProgramValidationError);
  });

  // R4 — an unknown trigger type is rejected.
  it("rejects an unknown trigger type", () => {
    const input = {
      schema: SCHEMA_VERSION,
      scripts: [{ id: "main", trigger: { type: "onCollision" }, statements: [] }],
    };
    expect(() => validateProgram(input)).toThrow(ProgramValidationError);
  });

  // R4 — malformed nesting (missing required field) fails validation, naming the path.
  it("rejects a statement missing a required field", () => {
    const input = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "move" }],
        },
      ],
    };
    expect(() => validateProgram(input)).toThrowError(/statements\[0\]\.steps/);
  });

  it("rejects non-object input", () => {
    expect(() => validateProgram(null)).toThrow(ProgramValidationError);
    expect(() => validateProgram("not a program")).toThrow(ProgramValidationError);
    expect(() => validateProgram(42)).toThrow(ProgramValidationError);
  });

  it("validates the full-coverage fixture exercising every variant", () => {
    expect(() => validateProgram(FULL_COVERAGE_PROGRAM)).not.toThrow();
  });
});
