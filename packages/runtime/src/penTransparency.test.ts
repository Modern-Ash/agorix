import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram, type Statement } from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";

const run = (statements: Statement[]) =>
  runProgram(
    {
      schema: SCHEMA_VERSION,
      extensions: ["pen"],
      scripts: [{ id: "main", trigger: { type: "greenFlag" }, statements }],
    } satisfies ProjectProgram,
    createWorldState(),
  ).world.pen;

describe("pen transparency", () => {
  it("marks the lines drawn after it, and leaves earlier ones solid", () => {
    const pen = run([
      { type: "penDown" },
      { type: "move", steps: 10 },
      { type: "setPenTransparency", percent: 50 },
      { type: "move", steps: 10 },
    ]);
    expect(pen?.segments.map((segment) => segment.transparency)).toEqual([
      undefined,
      undefined,
      50,
    ]);
  });
  it("is solid again at 0 and never stored for a world that never set it", () => {
    expect(run([{ type: "penDown" }])?.transparency).toBeUndefined();
    expect(
      run([
        { type: "setPenTransparency", percent: 25 },
        { type: "setPenTransparency", percent: 0 },
      ])?.transparency,
    ).toBeUndefined();
  });
});
