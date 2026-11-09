import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram, type Statement } from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";

const say = (): Statement => ({
  type: "say",
  text: "t",
  append: { type: "timer" },
});
const run = (statements: Statement[]) =>
  runProgram(
    {
      schema: SCHEMA_VERSION,
      scripts: [{ id: "main", trigger: { type: "greenFlag" }, statements }],
    } satisfies ProjectProgram,
    createWorldState(),
  ).world.sprite.bubble?.text;

describe("reset timer", () => {
  it("counts the waited seconds until it is reset, then counts again from zero", () => {
    expect(run([{ type: "wait", seconds: 2 }, say()])).toBe("t 2");
    expect(
      run([
        { type: "wait", seconds: 2 },
        { type: "resetTimer" },
        { type: "wait", seconds: 1 },
        say(),
      ]),
    ).toBe("t 1");
  });
});
