import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, validateProgram, type ProjectProgram } from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";

// Issue #735, Mis bloques version 3: a block hands its own number on to another block.
const num = (value: number) => ({ type: "numericLiteral" as const, value });
const program = (args: ProjectProgram["scripts"][number]["statements"]): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "s",
      trigger: { type: "greenFlag" },
      statements: [{ type: "callProcedure", procedureId: "b", args: [num(60)] }, ...args],
      procedures: [
        {
          id: "a",
          name: "Avanzar",
          params: [{ id: "p1", name: "largo" }],
          body: [{ type: "move", steps: 20, stepsFrom: "p1" }],
        },
        {
          id: "b",
          name: "Doble",
          params: [{ id: "p1", name: "base" }],
          body: [
            { type: "callProcedure", procedureId: "a", args: [{ type: "param", paramId: "p1" }] },
            { type: "callProcedure", procedureId: "a", args: [{ type: "param", paramId: "p1" }] },
          ],
        },
      ],
    },
  ],
});

describe("passing a custom block number to another block", () => {
  it("runs the inner block with the caller's value", () => {
    const result = runProgram(program([]), createWorldState());
    expect(result.world.sprite.x).toBe(createWorldState().sprite.x + 120);
    const passed = result.trace.filter((entry) => entry.statementType === "callProcedure");
    expect(passed.map((entry) => entry.args)).toEqual([[60], [60], [60]]);
  });

  it("rejects a passed number outside a custom block or beyond its own numbers", () => {
    const bad = program([
      { type: "callProcedure", procedureId: "a", args: [{ type: "param", paramId: "p1" }] },
    ]);
    expect(() => validateProgram(bad)).toThrow();
    const wide = structuredClone(program([]));
    (wide.scripts[0]!.procedures![1] as { body: unknown }).body = [
      { type: "callProcedure", procedureId: "a", args: [{ type: "param", paramId: "p2" }] },
    ];
    expect(() => validateProgram(wide)).toThrow();
    expect(() => validateProgram(program([]))).not.toThrow();
  });
});
