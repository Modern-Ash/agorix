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
      expect((error as ProgramValidationError).code).toBe("UNKNOWN_STATEMENT_TYPE");
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

  // R4 — event triggers are validated with bounded payloads.
  it("validates event trigger payloads and bounds", () => {
    const key = { type: "onKeyPressed", key: "ArrowUp" };
    const click = { type: "onActorClicked" };
    const message = { type: "onMessage", message: "go" };
    expect(
      validateProgram({
        schema: SCHEMA_VERSION,
        scripts: [{ id: "a", trigger: key, statements: [] }],
      }).scripts[0]?.trigger,
    ).toEqual(key);
    expect(
      validateProgram({
        schema: SCHEMA_VERSION,
        scripts: [{ id: "b", trigger: click, statements: [] }],
      }).scripts[0]?.trigger,
    ).toEqual(click);
    expect(
      validateProgram({
        schema: SCHEMA_VERSION,
        scripts: [{ id: "c", trigger: message, statements: [] }],
      }).scripts[0]?.trigger,
    ).toEqual(message);
    expect(() =>
      validateProgram({
        schema: SCHEMA_VERSION,
        scripts: [
          { id: "d", trigger: { type: "onKeyPressed", key: "x".repeat(41) }, statements: [] },
        ],
      }),
    ).toThrowError(/scripts\[0\]\.trigger\.key/);
    expect(() =>
      validateProgram({
        schema: SCHEMA_VERSION,
        scripts: [
          { id: "e", trigger: { type: "onMessage", message: "y".repeat(81) }, statements: [] },
        ],
      }),
    ).toThrowError(/scripts\[0\]\.trigger\.message/);
  });

  // R4 — broadcast message payload is validated at the statement level.
  it("validates broadcast statement messages within bounds", () => {
    const input = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "broadcast", message: "m".repeat(81) }],
        },
      ],
    };
    expect(() => validateProgram(input)).toThrowError(/statements\[0\]\.message/);
    const ok = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "broadcast", message: "go" }],
        },
      ],
    };
    expect(validateProgram(ok).scripts[0]?.statements[0]).toEqual({
      type: "broadcast",
      message: "go",
    });
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

describe("volume statements", () => {
  const programWith = (statement: unknown) =>
    ({
      schema: SCHEMA_VERSION,
      scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [statement] }],
    }) as never;

  it("accepts in-range volume statements", () => {
    expect(() => validateProgram(programWith({ type: "setVolume", volume: 0 }))).not.toThrow();
    expect(() => validateProgram(programWith({ type: "setVolume", volume: 100 }))).not.toThrow();
    expect(() => validateProgram(programWith({ type: "changeVolume", delta: -100 }))).not.toThrow();
    expect(() => validateProgram(programWith({ type: "changeVolume", delta: 100 }))).not.toThrow();
  });

  it("rejects out-of-range, non-finite and non-number values", () => {
    for (const volume of [150, -5, Number.NaN, Number.POSITIVE_INFINITY, "50"]) {
      expect(() => validateProgram(programWith({ type: "setVolume", volume }))).toThrow(
        ProgramValidationError,
      );
    }
    for (const delta of [101, -101, Number.NaN, "5"]) {
      expect(() => validateProgram(programWith({ type: "changeVolume", delta }))).toThrow(
        ProgramValidationError,
      );
    }
  });
});

describe("heading statements", () => {
  const programWith = (statement: unknown) =>
    ({
      schema: SCHEMA_VERSION,
      scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [statement] }],
    }) as never;

  it("accepts pointInDirection, pointTowards and bounceOnEdge", () => {
    for (const statement of [
      { type: "pointInDirection", degrees: 0 },
      { type: "pointInDirection", degrees: -180 },
      { type: "pointInDirection", degrees: 180 },
      { type: "pointTowards", actorId: "actor:studio-1-fox" },
      { type: "bounceOnEdge" },
    ]) {
      expect(() => validateProgram(programWith(statement))).not.toThrow();
    }
  });

  it("rejects out-of-range directions and empty targets", () => {
    for (const degrees of [181, -181, Number.NaN, "90"]) {
      expect(() => validateProgram(programWith({ type: "pointInDirection", degrees }))).toThrow(
        ProgramValidationError,
      );
    }
    for (const actorId of ["", undefined, 5]) {
      expect(() => validateProgram(programWith({ type: "pointTowards", actorId }))).toThrow(
        ProgramValidationError,
      );
    }
  });
});

describe("repeatUntil statement", () => {
  const programWith = (statement: unknown) =>
    ({
      schema: SCHEMA_VERSION,
      scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [statement] }],
    }) as never;
  const until = {
    type: "greaterThan",
    left: { type: "xPosition" },
    right: { type: "numericLiteral", value: 100 },
  };

  it("accepts a condition with a body", () => {
    expect(() =>
      validateProgram(
        programWith({
          type: "repeatUntil",
          condition: until,
          body: [{ type: "move", steps: 40 }],
        }),
      ),
    ).not.toThrow();
  });

  it("rejects a missing condition, a non-array body and excessive nesting", () => {
    expect(() =>
      validateProgram(programWith({ type: "repeatUntil", body: [{ type: "move", steps: 1 }] })),
    ).toThrow(ProgramValidationError);
    expect(() =>
      validateProgram(programWith({ type: "repeatUntil", condition: until, body: "x" })),
    ).toThrow(ProgramValidationError);
    let nested: unknown = { type: "move", steps: 1 };
    for (let i = 0; i < 25; i += 1) {
      nested = { type: "repeatUntil", condition: until, body: [nested] };
    }
    expect(() => validateProgram(programWith(nested))).toThrow(ProgramValidationError);
  });
});

describe("changeSize statement", () => {
  const programWith = (statement: unknown) =>
    ({
      schema: SCHEMA_VERSION,
      scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [statement] }],
    }) as never;

  it("accepts in-range deltas and rejects the rest", () => {
    for (const delta of [-100, 25, 100]) {
      expect(() => validateProgram(programWith({ type: "changeSize", delta }))).not.toThrow();
    }
    for (const delta of [101, -101, Number.NaN, "5", undefined]) {
      expect(() => validateProgram(programWith({ type: "changeSize", delta }))).toThrow(
        ProgramValidationError,
      );
    }
  });
});

describe("modulo expression", () => {
  const withValue = (value: unknown) =>
    ({
      schema: SCHEMA_VERSION,
      variables: [{ id: "n", name: "n", initialValue: 0, visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "setVariable", variableId: "n", value }],
        },
      ],
    }) as never;
  it("accepts two numeric operands and rejects a missing one", () => {
    expect(() =>
      validateProgram(
        withValue({
          type: "modulo",
          left: { type: "numericLiteral", value: 7 },
          right: { type: "numericLiteral", value: 3 },
        }),
      ),
    ).not.toThrow();
    expect(() =>
      validateProgram(withValue({ type: "modulo", left: { type: "numericLiteral", value: 7 } })),
    ).toThrow(ProgramValidationError);
  });
});

describe("mathFunction expression", () => {
  const withValue = (value: unknown) =>
    ({
      schema: SCHEMA_VERSION,
      variables: [{ id: "n", name: "n", initialValue: 0, visible: true }],
      scripts: [
        {
          id: "main",
          trigger: { type: "onStart" },
          statements: [{ type: "setVariable", variableId: "n", value }],
        },
      ],
    }) as never;
  const operand = { type: "numericLiteral", value: -2.5 };
  it("accepts the four functions and rejects unknown ones or a missing operand", () => {
    for (const fn of ["abs", "round", "floor", "ceiling"]) {
      expect(() =>
        validateProgram(withValue({ type: "mathFunction", function: fn, value: operand })),
      ).not.toThrow();
    }
    for (const fn of ["sqrt", "", 3, undefined]) {
      expect(() =>
        validateProgram(withValue({ type: "mathFunction", function: fn, value: operand })),
      ).toThrow(ProgramValidationError);
    }
    expect(() => validateProgram(withValue({ type: "mathFunction", function: "abs" }))).toThrow(
      ProgramValidationError,
    );
  });
});

describe("goToLayer statement", () => {
  const programWith = (statement: unknown) =>
    ({
      schema: SCHEMA_VERSION,
      scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [statement] }],
    }) as never;
  it("accepts front and back and rejects anything else", () => {
    for (const layer of ["front", "back"]) {
      expect(() => validateProgram(programWith({ type: "goToLayer", layer }))).not.toThrow();
    }
    for (const layer of ["middle", "", 1, undefined]) {
      expect(() => validateProgram(programWith({ type: "goToLayer", layer }))).toThrow(
        ProgramValidationError,
      );
    }
  });
});

describe("glideTo statement", () => {
  const programWith = (statement: unknown) =>
    ({
      schema: SCHEMA_VERSION,
      scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [statement] }],
    }) as never;
  it("accepts bounded coordinates and duration", () => {
    expect(() =>
      validateProgram(programWith({ type: "glideTo", x: 120, y: -40, seconds: 2 })),
    ).not.toThrow();
  });
  it("rejects out-of-range or missing values", () => {
    for (const bad of [
      { x: 1001, y: 0, seconds: 1 },
      { x: 0, y: -1001, seconds: 1 },
      { x: 0, y: 0, seconds: 0 },
      { x: 0, y: 0, seconds: 6 },
      { x: 0, y: 0 },
      { x: "0", y: 0, seconds: 1 },
      { x: Number.NaN, y: 0, seconds: 1 },
    ]) {
      expect(() => validateProgram(programWith({ type: "glideTo", ...bad }))).toThrow(
        ProgramValidationError,
      );
    }
  });
});

describe("procedures", () => {
  const withScript = (script: Record<string, unknown>) =>
    ({
      schema: SCHEMA_VERSION,
      scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [], ...script }],
    }) as never;
  const proc = (extra: Record<string, unknown> = {}) => ({
    id: "proc-1",
    name: "Saltar",
    body: [{ type: "move", steps: 10 }],
    ...extra,
  });

  it("accepts a procedure and a call to it, including a recursive one", () => {
    expect(() =>
      validateProgram(
        withScript({
          procedures: [proc()],
          statements: [{ type: "callProcedure", procedureId: "proc-1" }],
        }),
      ),
    ).not.toThrow();
    expect(() =>
      validateProgram(
        withScript({
          procedures: [proc({ body: [{ type: "callProcedure", procedureId: "proc-1" }] })],
          statements: [{ type: "callProcedure", procedureId: "proc-1" }],
        }),
      ),
    ).not.toThrow();
  });

  it("rejects a call to a procedure the script does not define", () => {
    expect(() =>
      validateProgram(
        withScript({ statements: [{ type: "callProcedure", procedureId: "proc-9" }] }),
      ),
    ).toThrow(ProgramValidationError);
  });

  it("rejects bad names, empty or oversized bodies, duplicates and too many procedures", () => {
    for (const bad of [
      proc({ name: "" }),
      proc({ name: "x".repeat(21) }),
      proc({ name: "<b>" }),
      proc({ body: [] }),
      proc({ body: Array.from({ length: 21 }, () => ({ type: "move", steps: 1 })) }),
      proc({ body: "x" }),
      proc({ id: "" }),
    ]) {
      expect(() => validateProgram(withScript({ procedures: [bad] }))).toThrow(
        ProgramValidationError,
      );
    }
    expect(() => validateProgram(withScript({ procedures: [proc(), proc()] }))).toThrow(
      ProgramValidationError,
    );
    expect(() =>
      validateProgram(
        withScript({
          procedures: Array.from({ length: 21 }, (_, i) => proc({ id: `proc-${i}` })),
        }),
      ),
    ).toThrow(ProgramValidationError);
  });
});

describe("procedureIdentifiers", () => {
  it("gives each custom block a stable, unique, ASCII identifier", async () => {
    const { procedureIdentifiers } = await import("./index.js");
    const named = (name: string, i: number) => ({
      id: `p${i}`,
      name,
      body: [{ type: "move" as const, steps: 1 }],
    });
    expect(
      procedureIdentifiers([
        named("Saltar alto", 0),
        named("saltar alto", 1),
        named("¡Ñandú!", 2),
        named("   ", 3),
        named("class", 4),
      ]),
    ).toEqual(["my_saltar_alto", "my_saltar_alto_2", "my_nandu", "my_block_4", "my_class"]);
  });
});

describe("graphic effect statements", () => {
  const programWith = (statement: unknown) =>
    ({
      schema: SCHEMA_VERSION,
      scripts: [{ id: "main", trigger: { type: "onStart" }, statements: [statement] }],
    }) as never;
  it("accepts each effect in its own range and clearEffects", () => {
    for (const statement of [
      { type: "setEffect", effect: "color", value: 200 },
      { type: "setEffect", effect: "ghost", value: 100 },
      { type: "setEffect", effect: "brightness", value: -100 },
      { type: "changeEffect", effect: "ghost", delta: -25 },
      { type: "clearEffects" },
    ]) {
      expect(() => validateProgram(programWith(statement))).not.toThrow();
    }
  });
  it("rejects unknown effects and out-of-range or non-numeric values", () => {
    for (const statement of [
      { type: "setEffect", effect: "blur", value: 10 },
      { type: "setEffect", effect: "ghost", value: 101 },
      { type: "setEffect", effect: "ghost", value: -1 },
      { type: "setEffect", effect: "color", value: 201 },
      { type: "setEffect", effect: "brightness", value: 101 },
      { type: "setEffect", effect: "ghost", value: "5" },
      { type: "setEffect", effect: "ghost", value: Number.NaN },
      { type: "changeEffect", effect: "ghost", delta: 201 },
      { type: "changeEffect", effect: "ghost" },
    ]) {
      expect(() => validateProgram(programWith(statement))).toThrow(ProgramValidationError);
    }
  });
});
