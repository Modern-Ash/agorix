import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  type ProcedureParam,
  type ProjectProgram,
  type Statement,
} from "@agorix/program-model";
import { createWorldState, runMultiActorProgram, runProgram } from "./index.js";

// Issue #538, Mis bloques version 2: numbers for custom blocks.
const num = (value: number) => ({ type: "numericLiteral" as const, value });
function build(
  statements: Statement[],
  procedures: { id: string; name: string; params?: ProcedureParam[]; body: Statement[] }[],
  variables: ProjectProgram["variables"] = undefined,
): ProjectProgram {
  return {
    schema: SCHEMA_VERSION,
    ...(variables ? { variables } : {}),
    scripts: [{ id: "s", trigger: { type: "greenFlag" }, statements, procedures }],
  };
}
const p = (...names: string[]): ProcedureParam[] =>
  names.map((name, index) => ({ id: `p${index + 1}` as ProcedureParam["id"], name }));
const call = (id: string, ...args: number[]): Statement => ({
  type: "callProcedure",
  procedureId: id,
  ...(args.length ? { args: args.map(num) } : {}),
});
const run = (program: ProjectProgram) => runProgram(program, createWorldState());
const square: Statement[] = [
  {
    type: "repeat",
    count: 4,
    body: [
      { type: "move", steps: 40, stepsFrom: "p1" },
      { type: "turn", degrees: 90 },
    ],
  },
];

describe("custom block numbers at run time", () => {
  it("a call with numbers equals the body written inline with those values", () => {
    const withCall = run(
      build(
        [call("a", 120), call("a", 80)],
        [{ id: "a", name: "Cuadrado", params: p("lado"), body: square }],
      ),
    );
    const inline = run(
      build(
        [
          {
            type: "repeat",
            count: 4,
            body: [
              { type: "move", steps: 120 },
              { type: "turn", degrees: 90 },
            ],
          },
          {
            type: "repeat",
            count: 4,
            body: [
              { type: "move", steps: 80 },
              { type: "turn", degrees: 90 },
            ],
          },
        ],
        [],
      ),
    );
    expect(withCall.world.sprite).toEqual(inline.world.sprite);
    const kinds = (r: typeof withCall) =>
      r.trace.map((e) => e.statementType).filter((t) => t !== "callProcedure");
    expect(kinds(withCall)).toEqual(kinds(inline));
  });

  it("each use passes its own numbers and a block can take three", () => {
    const result = run(
      build(
        [call("a", 40, 90, 2), call("a", 80, -90, 1)],
        [
          {
            id: "a",
            name: "Tres",
            params: p("paso", "giro", "veces"),
            body: [
              {
                type: "repeat",
                count: 1,
                countFrom: "p3",
                body: [
                  { type: "move", steps: 1, stepsFrom: "p1" },
                  { type: "turn", degrees: 1, degreesFrom: "p2" },
                ],
              },
            ],
          },
        ],
      ),
    );
    const moves = result.trace.filter((e) => e.statementType === "move");
    expect(moves).toHaveLength(3);
    expect(result.world.sprite.heading).toBe((((90 + 90 - 90) % 360) + 360) % 360);
  });

  it("the call step records the numbers it received; blocks without numbers record none", () => {
    const withNumbers = run(
      build([call("a", 120)], [{ id: "a", name: "Cuadrado", params: p("lado"), body: square }]),
    );
    expect(withNumbers.trace.find((e) => e.statementType === "callProcedure")?.args).toEqual([120]);
    const plain = run(
      build([call("a")], [{ id: "a", name: "Paso", body: [{ type: "move", steps: 40 }] }]),
    );
    const callStep = plain.trace.find((e) => e.statementType === "callProcedure")!;
    expect("args" in callStep).toBe(false);
    expect(
      runMultiActorProgram(
        build([call("a", 120)], [{ id: "a", name: "Cuadrado", params: p("lado"), body: square }]),
      ).trace.find((e) => e.statementType === "callProcedure")?.args,
    ).toEqual([120]);
  });

  it("out-of-range numbers are clamped to the same range as a fixed value and the run goes on", () => {
    const body: Statement[] = [
      { type: "move", steps: 1, stepsFrom: "p1" },
      { type: "turn", degrees: 1, degreesFrom: "p1" },
      { type: "wait", seconds: 1, secondsFrom: "p1" },
    ];
    const big = run(
      build([call("a", 99_999)], [{ id: "a", name: "Grande", params: p("n"), body }]),
    );
    expect(big.outcome).toBe("completed");
    expect(big.trace.find((e) => e.statementType === "move")!.worldAfter.sprite.x).toBe(1000);
    expect(big.trace.find((e) => e.statementType === "turn")!.worldAfter.sprite.heading).toBe(
      1000 % 360,
    );
    expect(big.virtualSeconds).toBe(5);
    const small = run(
      build([call("a", -99_999)], [{ id: "a", name: "Chico", params: p("n"), body }]),
    );
    expect(small.trace.find((e) => e.statementType === "move")!.worldAfter.sprite.x).toBe(-1000);
    expect(small.virtualSeconds).toBe(0.1);
    const zero = run(build([call("a", 0)], [{ id: "a", name: "Cero", params: p("n"), body }]));
    expect(zero.virtualSeconds).toBe(0.1);
  });

  it("the repeat count is rounded and kept between 1 and 1000", () => {
    const body: Statement[] = [
      { type: "repeat", count: 1, countFrom: "p1", body: [{ type: "move", steps: 1 }] },
    ];
    const moves = (n: number) =>
      run(build([call("a", n)], [{ id: "a", name: "R", params: p("veces"), body }])).trace.filter(
        (e) => e.statementType === "move",
      ).length;
    expect(moves(3)).toBe(3);
    expect(moves(2.6)).toBe(3);
    expect(moves(0)).toBe(1);
    expect(moves(-5)).toBe(1);
  });

  it("a runaway count still ends by the step budget, not by hanging", () => {
    const body: Statement[] = [
      { type: "repeat", count: 1, countFrom: "p1", body: [{ type: "move", steps: 1 }] },
    ];
    const result = runProgram(
      build([call("a", 5000)], [{ id: "a", name: "R", params: p("veces"), body }]),
      createWorldState(),
      { maxSteps: 50 },
    );
    expect(result.outcome).toBe("budget-exceeded");
  });

  it("the number works as a value in an expression", () => {
    const result = run(
      build(
        [call("a", 7)],
        [
          {
            id: "a",
            name: "Guardar",
            params: p("n"),
            body: [
              {
                type: "setVariable",
                variableId: "v",
                value: { type: "add", left: { type: "param", paramId: "p1" }, right: num(1) },
              },
            ],
          },
        ],
        [{ id: "v", name: "v", initialValue: 0, visible: false }],
      ),
    );
    expect(result.world.variables?.["v"]?.value).toBe(8);
  });

  it("calls nest: an inner call sees its own numbers and the outer keeps its own", () => {
    const result = run(
      build(
        [call("outer", 40)],
        [
          {
            id: "inner",
            name: "Dentro",
            params: p("n"),
            body: [{ type: "move", steps: 1, stepsFrom: "p1" }],
          },
          {
            id: "outer",
            name: "Fuera",
            params: p("m"),
            body: [call("inner", 200), { type: "move", steps: 1, stepsFrom: "p1" }],
          },
        ],
      ),
    );
    const xs = result.trace
      .filter((e) => e.statementType === "move")
      .map((e) => e.worldAfter.sprite.x);
    expect(xs).toEqual([200, 240]);
  });

  it("recursion with numbers still ends at the depth cap, and the next run starts clean", () => {
    const program = build(
      [call("a", 40)],
      [
        {
          id: "a",
          name: "Sin fin",
          params: p("n"),
          body: [{ type: "move", steps: 1, stepsFrom: "p1" }, call("a", 40)],
        },
      ],
    );
    const first = run(program);
    expect(first.outcome).toBe("budget-exceeded");
    expect(first.trace.filter((e) => e.statementType === "move")).toHaveLength(16);
    expect(JSON.stringify(run(program))).toBe(JSON.stringify(first));
  });

  it("works for a character in a multi-actor run", () => {
    const result = runMultiActorProgram(
      build([call("a", 120)], [{ id: "a", name: "Cuadrado", params: p("lado"), body: square }]),
    );
    expect(result.outcome).toBe("completed");
    expect(result.actors[0]?.world.sprite.x).toBeCloseTo(0, 6);
    expect(result.trace.filter((e) => e.statementType === "move")).toHaveLength(4);
  });
});
