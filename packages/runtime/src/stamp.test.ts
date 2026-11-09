import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram, type Statement } from "@agorix/program-model";
import { createWorldState, PEN_STAMPS_MAX, runProgram } from "./index.js";

const run = (statements: Statement[]) =>
  runProgram(
    {
      schema: SCHEMA_VERSION,
      extensions: ["pen"],
      scripts: [{ id: "main", trigger: { type: "greenFlag" }, statements }],
    } satisfies ProjectProgram,
    createWorldState({ sprite: { x: 10, y: 5 } }),
  ).world;

describe("stamp", () => {
  it("leaves a copy where the character is, at its size", () => {
    const world = run([
      { type: "setSize", size: 150 },
      { type: "stamp" },
      { type: "move", steps: 40 },
      { type: "stamp" },
    ]);
    expect(world.pen?.stamps).toEqual([
      { x: 10, y: 5, size: 150 },
      { x: 50, y: 5, size: 150 },
    ]);
  });
  it("is erased with the drawing, and stops at the limit without failing", () => {
    expect(run([{ type: "stamp" }, { type: "clearPen" }]).pen?.stamps).toBeUndefined();
    const many = run(
      Array.from({ length: PEN_STAMPS_MAX + 5 }, () => ({ type: "stamp" }) as Statement),
    );
    expect(many.pen?.stamps).toHaveLength(PEN_STAMPS_MAX);
  });
});
