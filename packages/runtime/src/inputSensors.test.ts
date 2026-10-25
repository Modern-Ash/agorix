import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  validateProgram,
  type ProjectProgram,
  type Statement,
  type Trigger,
} from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";

// Issue #733: a timer and key-held sensors that stay deterministic.
const program = (trigger: Trigger, statements: Statement[]): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [{ id: "s", trigger, statements }],
});
const keyDown = (key: string) => ({ type: "keyDown" as const, key });

describe("timer sensor", () => {
  it("counts the seconds the script has waited, and ends a loop at a time limit", () => {
    const result = runProgram(
      program({ type: "greenFlag" }, [
        {
          type: "repeatUntil",
          condition: {
            type: "greaterOrEqual",
            left: { type: "timer" },
            right: { type: "numericLiteral", value: 2 },
          },
          body: [
            { type: "wait", seconds: 0.5 },
            { type: "move", steps: 20 },
          ],
        },
      ]),
      createWorldState(),
    );
    expect(result.virtualSeconds).toBe(2);
    expect(result.world.sprite.x - createWorldState().sprite.x).toBe(80);
  });
});

describe("keyDown sensor", () => {
  const branch = (trigger: Trigger): ProjectProgram =>
    program(trigger, [
      {
        type: "if",
        condition: keyDown("ArrowRight"),
        then: [{ type: "move", steps: 20 }],
        else: [{ type: "move", steps: -20 }],
      },
    ]);
  const start = createWorldState().sprite.x;

  it("is true for the key that started the script, false for another", () => {
    const direct = runProgram(
      branch({ type: "onKeyPressed", key: "ArrowRight" }),
      createWorldState(),
      {
        event: "key:ArrowRight",
      },
    );
    expect(direct.world.sprite.x).toBe(start + 20);
    const other = runProgram(
      branch({ type: "onKeyPressed", key: "ArrowLeft" }),
      createWorldState(),
      {
        event: "key:ArrowLeft",
      },
    );
    expect(other.world.sprite.x).toBe(start - 20);
  });

  it("is true when the run is given the key as held, and false otherwise", () => {
    const held = runProgram(branch({ type: "greenFlag" }), createWorldState(), {
      keysDown: ["ArrowRight"],
    });
    const idle = runProgram(branch({ type: "greenFlag" }), createWorldState());
    expect(held.world.sprite.x).toBe(start + 20);
    expect(idle.world.sprite.x).toBe(start - 20);
  });

  it("rejects a key name that is not letters and digits", () => {
    expect(() =>
      validateProgram(
        program({ type: "greenFlag" }, [
          { type: "if", condition: keyDown("../x"), then: [{ type: "move", steps: 20 }] },
        ]),
      ),
    ).toThrow();
  });
});
