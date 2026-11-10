import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, validateProgram, type ProjectProgram } from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";

const program = (shade: string): unknown => ({
  schema: SCHEMA_VERSION,
  extensions: ["pen"],
  scripts: [
    {
      id: "main",
      trigger: { type: "greenFlag" },
      statements: [
        { type: "penDown" },
        { type: "move", steps: 10 },
        { type: "setPenShade", shade },
        { type: "move", steps: 10 },
        { type: "setPenShade", shade: "normal" },
        { type: "move", steps: 10 },
      ],
    },
  ],
});

describe("pen shade", () => {
  it("marks only the segments drawn while a shade is set", () => {
    const run = runProgram(
      validateProgram(program("lighter")) as ProjectProgram,
      createWorldState(),
    );
    const shades = run.world.pen!.segments.map((segment) => segment.shade);
    expect(shades).toEqual([undefined, undefined, "lighter", undefined]);
  });

  it("rejects a shade outside the closed list", () => {
    expect(() => validateProgram(program("neon"))).toThrow();
  });
});
