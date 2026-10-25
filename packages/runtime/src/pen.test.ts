import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  validateProgram,
  type ProjectProgram,
  type Statement,
} from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";

// ADR 0011, issue #737: the pen extension, deterministic and bounded.
const program = (statements: Statement[], declare = true): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  ...(declare ? { extensions: ["pen" as const] } : {}),
  scripts: [{ id: "s", trigger: { type: "greenFlag" }, statements }],
});
const run = (statements: Statement[]) => runProgram(program(statements), createWorldState());

describe("pen extension", () => {
  it("draws a line only while the pen is down", () => {
    const result = run([
      { type: "move", steps: 20 },
      { type: "penDown" },
      { type: "move", steps: 40 },
      { type: "penUp" },
      { type: "move", steps: 60 },
    ]);
    const pen = result.world.pen!;
    expect(pen.down).toBe(false);
    expect(pen.segments).toEqual([
      { x1: 20, y1: 0, x2: 20, y2: 0, color: "dark", size: 4 },
      { x1: 20, y1: 0, x2: 60, y2: 0, color: "dark", size: 4 },
    ]);
  });

  it("uses the colour and size chosen, and clear removes the drawing", () => {
    const drawn = run([
      { type: "setPenColor", color: "red" },
      { type: "setPenSize", size: 8 },
      { type: "penDown" },
      { type: "goTo", x: 10, y: 10 },
    ]);
    expect(drawn.world.pen!.segments.at(-1)).toMatchObject({
      color: "red",
      size: 8,
      x2: 10,
      y2: 10,
    });
    const cleared = run([{ type: "penDown" }, { type: "move", steps: 20 }, { type: "clearPen" }]);
    expect(cleared.world.pen!.segments).toEqual([]);
    expect(cleared.world.pen!.down).toBe(true);
  });

  it("draws a repeated move once per pass, not once more for the loop", () => {
    const result = run([
      { type: "penDown" },
      { type: "repeat", count: 4, body: [{ type: "move", steps: 20 }] },
    ]);
    expect(result.world.pen!.segments).toHaveLength(5);
  });

  it("leaves worlds without pen blocks unchanged", () => {
    const result = runProgram(
      {
        schema: SCHEMA_VERSION,
        scripts: [
          { id: "s", trigger: { type: "greenFlag" }, statements: [{ type: "move", steps: 20 }] },
        ],
      },
      createWorldState(),
    );
    expect(result.world.pen).toBeUndefined();
  });

  it("stops adding line pieces at the limit and says so", () => {
    const result = run([
      { type: "penDown" },
      {
        type: "repeat",
        count: 1000,
        body: [
          { type: "move", steps: 1 },
          { type: "move", steps: -1 },
        ],
      },
    ]);
    expect(result.world.pen!.segments.length).toBe(400);
    expect(result.notes).toContain("pen: drawing limit reached");
  });

  it("is the same on every run", () => {
    const steps: Statement[] = [
      { type: "penDown" },
      {
        type: "repeat",
        count: 4,
        body: [
          { type: "move", steps: 40 },
          { type: "turn", degrees: 90 },
        ],
      },
    ];
    expect(run(steps).world).toEqual(run(steps).world);
  });
});

describe("pen declaration", () => {
  it("requires the project to declare the extension it uses", () => {
    expect(() => validateProgram(program([{ type: "penDown" }], false))).toThrow();
    expect(() => validateProgram(program([{ type: "penDown" }]))).not.toThrow();
  });

  it("rejects unknown or repeated extension ids and bad pen values", () => {
    const base = program([{ type: "penDown" }]);
    for (const extensions of [["camera"], ["pen", "pen"], []]) {
      expect(() => validateProgram({ ...base, extensions })).toThrow();
    }
    for (const bad of [
      { type: "setPenColor", color: "#ff0000" },
      { type: "setPenSize", size: 0 },
      { type: "setPenSize", size: 25 },
      { type: "setPenSize", size: 2.5 },
    ]) {
      expect(() => validateProgram(program([bad as never]))).toThrow();
    }
  });
});
