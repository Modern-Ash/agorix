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

describe("next costume", () => {
  const costumes = ["costume:mika", "costume:studio-art-1", "costume:studio-art-2"];
  const after = (times: number, start?: string) => {
    const world = createWorldState(
      start === undefined ? {} : { sprite: { x: 0, y: 0, heading: 0, costumeId: start } },
    );
    return runProgram(
      program(
        Array.from(
          { length: times },
          () => ({ type: "nextCostume", costumeIds: costumes }) as Statement,
        ),
      ),
      world,
    ).world.sprite.costumeId;
  };
  it("goes to the next costume in the list and wraps around", () => {
    expect(after(1, "costume:mika")).toBe("costume:studio-art-1");
    expect(after(2, "costume:mika")).toBe("costume:studio-art-2");
    expect(after(3, "costume:mika")).toBe("costume:mika");
  });
  it("goes to the first costume when the current one is not in the list", () => {
    expect(after(1, "costume:nova")).toBe("costume:mika");
    expect(after(1)).toBe("costume:mika");
  });
});

describe("rotation style", () => {
  it("sets the style, and 'all around' puts it back to the default", () => {
    const style = (statements: Statement[]) =>
      runProgram(program(statements), createWorldState()).world.sprite.rotationStyle;
    expect(style([{ type: "setRotationStyle", style: "leftRight" }])).toBe("leftRight");
    expect(style([{ type: "setRotationStyle", style: "none" }])).toBe("none");
    expect(
      style([
        { type: "setRotationStyle", style: "none" },
        { type: "setRotationStyle", style: "all" },
      ]),
    ).toBeUndefined();
  });

  it("leaves sprites that never set it exactly as before", () => {
    const world = runProgram(program([{ type: "turn", degrees: 90 }]), createWorldState()).world;
    expect("rotationStyle" in world.sprite).toBe(false);
  });
});
