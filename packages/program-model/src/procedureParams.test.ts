import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type Statement } from "./schema.js";
import { ProgramValidationError, validateProgram } from "./validate.js";

// Issue #538, Mis bloques version 2: custom blocks can take up to three numbers.
const num = (value: number) => ({ type: "numericLiteral" as const, value });
const program = (
  statements: Statement[],
  procedures: unknown[],
  variables: unknown[] = [],
): unknown => ({
  schema: SCHEMA_VERSION,
  ...(variables.length ? { variables } : {}),
  scripts: [{ id: "studio-actor-1-nova", trigger: { type: "greenFlag" }, statements, procedures }],
});
const lado = { id: "p1", name: "lado" };
const square = (extra: Record<string, unknown> = {}) => ({
  id: "proc-1-1",
  name: "Cuadrado",
  params: [lado],
  body: [
    {
      type: "repeat",
      count: 4,
      countFrom: undefined,
      body: [
        { type: "move", steps: 40, stepsFrom: "p1" },
        { type: "turn", degrees: 90 },
      ],
    },
  ].map((statement) => JSON.parse(JSON.stringify(statement))),
  ...extra,
});
const call = (args?: unknown) =>
  ({
    type: "callProcedure",
    procedureId: "proc-1-1",
    ...(args === undefined ? {} : { args }),
  }) as unknown as Statement;
const invalid = (input: unknown) =>
  expect(() => validateProgram(input)).toThrow(ProgramValidationError);

describe("custom block numbers: valid programs", () => {
  it("accepts a block with numbers, bound fields and a call with its numbers", () => {
    const ok = program([call([num(120)])], [square()]);
    expect(validateProgram(ok)).toEqual(ok);
  });

  it("accepts every bound field and the param expression", () => {
    const ok = program(
      [call([num(2), num(1), num(3)])],
      [
        {
          id: "proc-1-1",
          name: "Todo",
          params: [lado, { id: "p2", name: "giro" }, { id: "p3", name: "veces" }],
          body: [
            { type: "repeat", count: 2, countFrom: "p3", body: [{ type: "hide" }] },
            { type: "move", steps: 40, stepsFrom: "p1" },
            { type: "turn", degrees: 90, degreesFrom: "p2" },
            { type: "wait", seconds: 1, secondsFrom: "p1" },
            {
              type: "setVariable",
              variableId: "v",
              value: { type: "add", left: { type: "param", paramId: "p1" }, right: num(1) },
            },
          ],
        },
      ],
      [{ id: "v", name: "v", initialValue: 0, visible: false }],
    );
    expect(validateProgram(ok)).toEqual(ok);
  });

  it("leaves programs without numbers byte-identical (no params, args or From keys appear)", () => {
    const plain = program(
      [{ type: "callProcedure", procedureId: "proc-1-1" }],
      [{ id: "proc-1-1", name: "Paso", body: [{ type: "move", steps: 40 }] }],
    );
    const text = JSON.stringify(validateProgram(plain));
    expect(text).not.toMatch(/params|args|From|"param"/);
    expect(validateProgram(plain)).toEqual(plain);
  });
});

describe("custom block numbers: rejected programs", () => {
  it("rejects a bound field outside a block, or naming a number the block does not have", () => {
    invalid({
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "s",
          trigger: { type: "greenFlag" },
          statements: [{ type: "move", steps: 40, stepsFrom: "p1" }],
        },
      ],
    });
    invalid(
      program([call([num(1)])], [square({ body: [{ type: "move", steps: 40, stepsFrom: "p2" }] })]),
    );
    invalid(
      program(
        [call([num(1)])],
        [{ id: "proc-1-1", name: "Sin", body: [{ type: "move", steps: 40, stepsFrom: "p1" }] }],
      ),
    );
    for (const bad of ["p4", "lado", "", 1, null, {}]) {
      invalid(
        program(
          [call([num(1)])],
          [square({ body: [{ type: "move", steps: 40, stepsFrom: bad }] })],
        ),
      );
    }
  });

  it("rejects the number expression outside the block that declares it", () => {
    const variable = [{ id: "v", name: "v", initialValue: 0, visible: false }];
    invalid(
      program(
        [
          {
            type: "setVariable",
            variableId: "v",
            value: { type: "param", paramId: "p1" },
          } as Statement,
        ],
        [square()],
        variable,
      ),
    );
    invalid(
      program(
        [call([num(1)])],
        [
          square({
            body: [
              { type: "setVariable", variableId: "v", value: { type: "param", paramId: "p2" } },
            ],
          }),
        ],
        variable,
      ),
    );
  });

  it("rejects a call with the wrong number of numbers or numbers that are not fixed", () => {
    invalid(program([call()], [square()]));
    invalid(program([call([])], [square()]));
    invalid(program([call([num(1), num(2)])], [square()]));
    invalid(
      program(
        [call([num(1)])],
        [{ id: "proc-1-1", name: "Paso", body: [{ type: "move", steps: 40 }] }],
      ),
    );
    invalid(
      program(
        [call([{ type: "variable", variableId: "v" }])],
        [square()],
        [{ id: "v", name: "v", initialValue: 0, visible: false }],
      ),
    );
    invalid(program([call([{ type: "add", left: num(1), right: num(2) }])], [square()]));
    invalid(program([call([num(2_000_000)])], [square()]));
    invalid(program([call("3")], [square()]));
  });

  it("rejects bad number declarations", () => {
    invalid(program([call([num(1)])], [square({ params: [] })]));
    invalid(program([call([num(1)])], [square({ params: "lado" })]));
    invalid(
      program(
        [call([num(1), num(1), num(1), num(1)])],
        [
          square({
            params: [
              lado,
              { id: "p2", name: "b" },
              { id: "p3", name: "c" },
              { id: "p4", name: "d" },
            ],
          }),
        ],
      ),
    );
    invalid(program([call([num(1)])], [square({ params: [{ id: "p2", name: "lado" }] })]));
    invalid(
      program([call([num(1), num(1)])], [square({ params: [lado, { id: "p3", name: "otro" }] })]),
    );
    invalid(
      program([call([num(1), num(1)])], [square({ params: [lado, { id: "p2", name: "LADO" }] })]),
    );
    for (const name of ["", "x".repeat(21), "<script>", "a\nb", 5, null]) {
      invalid(program([call([num(1)])], [square({ params: [{ id: "p1", name }] })]));
    }
    invalid(
      program([call([num(1)])], [square({ params: [{ id: "p1", name: "lado", extra: true }] })]),
    );
  });

  it("counts the arguments toward the program size limit", () => {
    const many = Array.from({ length: 600 }, () => call([num(1)]));
    invalid(program(many, [square()]));
  });
});
