import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram, type Statement } from "@agorix/program-model";
import { createWorldState, runMultiActorProgram, runProgram } from "./index.js";

// Issue #466: `wait` advances a virtual clock only; it never uses a real timer.
const program = (statements: Statement[]): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
});

describe("wait (issue #466)", () => {
  it("orders events and adds virtual seconds without touching the world", () => {
    const result = runProgram(
      program([
        { type: "move", steps: 1 },
        { type: "wait", seconds: 2 },
        { type: "move", steps: 1 },
      ]),
      createWorldState(),
    );
    expect(result.trace.map((entry) => entry.statementType)).toEqual(["move", "wait", "move"]);
    const wait = result.trace[1]!;
    expect(wait.worldAfter).toEqual(wait.worldBefore);
    expect(result.world.sprite.x).toBe(2);
    expect(result.virtualSeconds).toBe(2);
    expect(result.outcome).toBe("completed");
  });

  it("sums fractions without floating-point drift", () => {
    const result = runProgram(
      program(Array.from({ length: 10 }, () => ({ type: "wait", seconds: 0.1 }) as Statement)),
      createWorldState(),
    );
    expect(result.virtualSeconds).toBe(1);
  });

  it("stops with budget-exceeded past 60 virtual seconds, keeping earlier effects", () => {
    const statements: Statement[] = [{ type: "move", steps: 1 }];
    for (let i = 0; i < 13; i++) statements.push({ type: "wait", seconds: 5 });
    statements.push({ type: "move", steps: 1 });
    const result = runProgram(program(statements), createWorldState());
    expect(result.outcome).toBe("budget-exceeded");
    expect(result.world.sprite.x).toBe(1);
    const exactly = runProgram(
      program(Array.from({ length: 12 }, () => ({ type: "wait", seconds: 5 }) as Statement)),
      createWorldState(),
    );
    expect(exactly.outcome).toBe("completed");
    expect(exactly.virtualSeconds).toBe(60);
  });

  it("counts as one step, so step mode pauses before and after it", () => {
    const steps = program([
      { type: "move", steps: 1 },
      { type: "wait", seconds: 1 },
      { type: "move", steps: 1 },
    ]);
    const stopped = runProgram(steps, createWorldState(), { stopAfterSteps: 2 });
    expect(stopped.outcome).toBe("stopped");
    expect(stopped.trace.map((entry) => entry.statementType)).toEqual(["move", "wait"]);
    expect(stopped.virtualSeconds).toBe(1);
  });

  it("leaves programs without wait byte-identical (no virtualSeconds key)", () => {
    const result = runProgram(program([{ type: "move", steps: 1 }]), createWorldState());
    expect("virtualSeconds" in result).toBe(false);
  });

  it("runs inside a repeat, if and a multi-actor script", () => {
    const looped = runProgram(
      program([{ type: "repeat", count: 3, body: [{ type: "wait", seconds: 1 }] }]),
      createWorldState(),
    );
    expect(looped.virtualSeconds).toBe(3);
    const multi = runMultiActorProgram(
      program([
        { type: "wait", seconds: 1 },
        { type: "move", steps: 1 },
      ]),
    );
    expect(multi.outcome).toBe("completed");
    expect(multi.trace.map((entry) => entry.statementType)).toEqual(["wait", "move"]);
  });

  it("never uses a real timer", () => {
    const original = globalThis.setTimeout;
    globalThis.setTimeout = (() => {
      throw new Error("setTimeout used");
    }) as unknown as typeof setTimeout;
    try {
      expect(() =>
        runProgram(program([{ type: "wait", seconds: 5 }]), createWorldState()),
      ).not.toThrow();
    } finally {
      globalThis.setTimeout = original;
    }
  });
});
