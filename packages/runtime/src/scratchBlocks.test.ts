import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram, type Statement } from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";
import { createLiveRuntime, LIVE_TICK_SECONDS } from "./liveRuntime.js";

const program = (statements: Statement[]): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
});

describe("Scratch motion and looks blocks", () => {
  it("sets and changes one coordinate without touching the other or the heading", () => {
    const result = runProgram(
      program([
        { type: "turn", degrees: 90 },
        { type: "setX", x: 50 },
        { type: "setY", y: -20 },
        { type: "changeX", dx: 30 },
        { type: "changeY", dy: -10 },
      ]),
      createWorldState(),
    );
    const { x, y, heading } = result.world.sprite;
    expect({ x, y, heading }).toEqual({ x: 80, y: -30, heading: 90 });
  });

  it("reports the heading as a number", () => {
    const result = runProgram(
      {
        schema: SCHEMA_VERSION,
        variables: [{ id: "dir", name: "dir", initialValue: 0, visible: false }],
        scripts: [
          {
            id: "main",
            trigger: { type: "onStart" },
            statements: [
              { type: "turn", degrees: 45 },
              { type: "setVariable", variableId: "dir", value: { type: "direction" } },
            ],
          },
        ],
      },
      createWorldState(),
    );
    expect(result.world.variables?.dir?.value).toBe(45);
  });

  it("draws the pen trail for the new moves", () => {
    const result = runProgram(
      {
        schema: SCHEMA_VERSION,
        extensions: ["pen"],
        scripts: [
          {
            id: "main",
            trigger: { type: "onStart" },
            statements: [{ type: "penDown" }, { type: "changeX", dx: 40 }],
          },
        ],
      },
      createWorldState(),
    );
    const segments = result.world.pen?.segments ?? [];
    expect(segments.at(-1)).toMatchObject({ x1: 0, x2: 40 });
  });

  it("say for N seconds keeps the bubble in the trace, spends the time and ends without it", () => {
    const result = runProgram(
      program([
        { type: "say", text: "Hola", seconds: 2 },
        { type: "move", steps: 1 },
      ]),
      createWorldState(),
    );
    expect(result.trace[0]!.worldAfter.sprite.bubble).toEqual({ kind: "say", text: "Hola" });
    expect(result.trace[1]!.worldBefore.sprite.bubble).toBeUndefined();
    expect(result.world.sprite.bubble).toBeUndefined();
    expect(result.virtualSeconds).toBe(2);
  });

  it("a plain say still leaves its bubble on", () => {
    const result = runProgram(program([{ type: "say", text: "Hola" }]), createWorldState());
    expect(result.world.sprite.bubble).toEqual({ kind: "say", text: "Hola" });
  });

  it("live: the bubble stays for its seconds and then goes away", () => {
    const live = createLiveRuntime(program([{ type: "think", text: "Mmm", seconds: 1 }]));
    live.fire({ type: "start" });
    const bubble = () => live.result().actors[0]!.world.sprite.bubble;
    for (let t = 0; t < 0.5; t += LIVE_TICK_SECONDS) live.advance(LIVE_TICK_SECONDS);
    expect(bubble()).toEqual({ kind: "think", text: "Mmm" });
    for (let t = 0; t < 1; t += LIVE_TICK_SECONDS) live.advance(LIVE_TICK_SECONDS);
    expect(bubble()).toBeUndefined();
    expect(live.running).toBe(false);
  });
});

describe("go to random position or the pointer, and broadcast and wait", () => {
  it("goes to a seeded random spot inside the stage, the same one every time", () => {
    const p = program([{ type: "goToTarget", target: "random" }]);
    const spots = [1, 2, 3, 4, 5, 6].map((seed) => {
      const { x, y } = runProgram(p, createWorldState(), { randomSeed: seed }).world.sprite;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(320);
      expect(y).toBeGreaterThanOrEqual(-100);
      expect(y).toBeLessThanOrEqual(120);
      return `${x},${y}`;
    });
    expect(new Set(spots).size).toBeGreaterThan(1);
    const again = runProgram(p, createWorldState(), { randomSeed: 3 }).world.sprite;
    expect(`${again.x},${again.y}`).toBe(spots[2]);
  });

  it("goes to the pointer captured for the run, kept inside the stage", () => {
    const p = program([{ type: "goToTarget", target: "mouse" }]);
    const inside = runProgram(p, createWorldState(), {
      pointer: { x: 100, y: 20, down: false },
    }).world.sprite;
    expect([inside.x, inside.y]).toEqual([100, 20]);
    const outside = runProgram(p, createWorldState(), {
      pointer: { x: 900, y: -900, down: false },
    }).world.sprite;
    expect([outside.x, outside.y]).toEqual([320, -100]);
  });

  const talker = (wait: boolean): ProjectProgram => ({
    schema: SCHEMA_VERSION,
    scripts: [
      {
        id: "sender",
        trigger: { type: "greenFlag" },
        statements: [
          { type: "broadcast", message: "go", ...(wait ? { wait: true } : {}) },
          { type: "setX", x: 99 },
        ],
      },
      {
        id: "listener",
        trigger: { type: "onMessage", message: "go" },
        statements: [
          { type: "wait", seconds: 1 },
          { type: "setY", y: 7 },
        ],
      },
    ],
  });

  function senderX(wait: boolean, seconds: number): number {
    const live = createLiveRuntime(talker(wait));
    live.fire({ type: "start" });
    for (let t = 0; t < seconds; t += LIVE_TICK_SECONDS) live.advance(LIVE_TICK_SECONDS);
    return live.result().actors[0]!.world.sprite.x;
  }

  it("a plain broadcast lets the sender go on; broadcast and wait holds it until the listener ends", () => {
    expect(senderX(false, 0.3)).toBe(99);
    expect(senderX(true, 0.3)).toBe(0);
    expect(senderX(true, 2)).toBe(99);
  });
});

describe("say with a number after the text", () => {
  const withScore = (statements: Statement[]): ProjectProgram => ({
    schema: SCHEMA_VERSION,
    variables: [{ id: "score", name: "score", initialValue: 0, visible: false }],
    scripts: [{ id: "main", trigger: { type: "onStart" }, statements }],
  });
  it("writes the variable's value right after the text, in the bubble and the trace", () => {
    const result = runProgram(
      withScore([
        {
          type: "changeVariable",
          variableId: "score",
          delta: { type: "numericLiteral", value: 7 },
        },
        {
          type: "say",
          text: "Puntos: ",
          append: { type: "variable", variableId: "score" },
        },
      ]),
      createWorldState(),
    );
    expect(result.world.sprite.bubble).toEqual({ kind: "say", text: "Puntos: 7" });
    expect(result.trace.at(-1)!.worldAfter.sprite.bubble?.text).toBe("Puntos: 7");
  });
  it("works for think, for a position and together with seconds", () => {
    const result = runProgram(
      program([
        { type: "setX", x: 42 },
        { type: "think", text: "x = ", append: { type: "xPosition" }, seconds: 1 },
      ]),
      createWorldState(),
    );
    expect(result.trace.at(-1)!.worldAfter.sprite.bubble).toEqual({
      kind: "think",
      text: "x = 42",
    });
    expect(result.world.sprite.bubble).toBeUndefined();
  });
  it("keeps a decimal short", () => {
    const result = runProgram(
      program([
        {
          type: "say",
          text: "n =",
          append: {
            type: "divide",
            left: { type: "numericLiteral", value: 10 },
            right: { type: "numericLiteral", value: 3 },
          },
        },
      ]),
      createWorldState(),
    );
    expect(result.world.sprite.bubble?.text).toBe("n = 3.33");
  });
});
