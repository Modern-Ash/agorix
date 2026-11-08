import { describe, expect, it } from "vitest";
import { createLiveRuntime, LIVE_TICK_SECONDS, replayLiveRuntime } from "./liveRuntime.js";
import { runMultiActorProgram } from "./multiActor.js";

const program = (scripts: unknown[]) => ({ schema: "agorix/program/v1", scripts }) as never;
const flag = { type: "greenFlag" };

const penProgram = (scripts: unknown[]) =>
  ({ schema: "agorix/program/v1", extensions: ["pen"], scripts }) as never;

function run(live: ReturnType<typeof createLiveRuntime>, seconds: number) {
  const entries = [];
  for (let t = 0; t < seconds; t += LIVE_TICK_SECONDS)
    entries.push(...live.advance(LIVE_TICK_SECONDS));
  return entries;
}

describe("live runtime", () => {
  it("ends a finite script with the same final world as the batch run", () => {
    const p = program([
      {
        id: "s1",
        trigger: flag,
        statements: [
          { type: "move", steps: 40 },
          { type: "turn", degrees: 90 },
          { type: "move", steps: 40 },
        ],
      },
    ]);
    const live = createLiveRuntime(p);
    live.fire({ type: "start" });
    run(live, 1);
    expect(live.running).toBe(false);
    const batch = runMultiActorProgram(p);
    expect(live.result().actors[0]!.world.sprite).toEqual(batch.actors[0]!.world.sprite);
  });

  it("makes a wait last its seconds and keeps a forever loop going until the session ends", () => {
    const p = program([
      {
        id: "s1",
        trigger: flag,
        statements: [
          { type: "wait", seconds: 1 },
          { type: "forever", body: [{ type: "move", steps: 1 }] },
        ],
      },
    ]);
    const live = createLiveRuntime(p);
    live.fire({ type: "start" });
    run(live, 0.5);
    expect(live.result().actors[0]!.world.sprite.x).toBe(0);
    run(live, 2);
    const x = live.result().actors[0]!.world.sprite.x;
    expect(x).toBeGreaterThan(10);
    expect(live.running).toBe(true);
    run(live, 1);
    expect(live.result().actors[0]!.world.sprite.x).toBeGreaterThan(x);
  });

  it("runs the scripts of an actor at the same time", () => {
    const p = program([
      {
        id: "a",
        trigger: flag,
        statements: [{ type: "repeat", count: 10, body: [{ type: "move", steps: 1 }] }],
      },
      {
        id: "b",
        trigger: flag,
        statements: [{ type: "repeat", count: 10, body: [{ type: "turn", degrees: 1 }] }],
      },
    ]);
    const live = createLiveRuntime(p);
    live.fire({ type: "start" });
    run(live, 0.2);
    const sprite = live.result().actors[0]!.world.sprite;
    // Both are partway: neither waited for the other to finish.
    expect(sprite.x).toBeGreaterThan(0);
    expect(sprite.x).toBeLessThan(10);
    expect(sprite.heading).toBeGreaterThan(0);
    expect(sprite.heading).toBeLessThan(10);
  });

  it("reacts to a key pressed while a forever loop runs, and restarts the script on a repeat", () => {
    const p = program([
      {
        id: "a",
        trigger: flag,
        statements: [{ type: "forever", body: [{ type: "move", steps: 1 }] }],
      },
      {
        id: "k",
        trigger: { type: "onKeyPressed", key: "ArrowUp" },
        statements: [{ type: "turn", degrees: 90 }],
      },
    ]);
    const live = createLiveRuntime(p);
    live.fire({ type: "start" });
    run(live, 0.3);
    const before = live.result().actors[0]!.world.sprite.heading;
    live.fire({ type: "keyPressed", key: "ArrowUp" });
    run(live, 0.2);
    expect(live.result().actors[0]!.world.sprite.heading).toBe(before + 90);
    live.fire({ type: "keyPressed", key: "ArrowUp" });
    run(live, 0.2);
    expect(live.result().actors[0]!.world.sprite.heading).toBe(before + 180);
  });

  it("seeds variables and keeps their values in the actor's world", () => {
    const p = {
      schema: "agorix/program/v1",
      variables: [{ id: "score", name: "score", initialValue: 5, visible: true }],
      scripts: [
        {
          id: "a",
          trigger: flag,
          statements: [
            {
              type: "changeVariable",
              variableId: "score",
              delta: { type: "numericLiteral", value: 2 },
            },
          ],
        },
      ],
    } as never;
    const live = createLiveRuntime(p);
    live.fire({ type: "start" });
    run(live, 0.5);
    expect(live.result().actors[0]!.world.variables?.score?.value).toBe(7);
  });

  it("is bounded: a forever loop stops at the entry limit", () => {
    const p = program([
      {
        id: "a",
        trigger: flag,
        statements: [{ type: "forever", body: [{ type: "move", steps: 1 }] }],
      },
    ]);
    const live = createLiveRuntime(p, {}, { maxEntries: 50 });
    live.fire({ type: "start" });
    run(live, 10);
    expect(live.running).toBe(false);
    expect(live.result().outcome).toBe("budget-exceeded");
    expect(live.result().trace.length).toBeLessThanOrEqual(51);
  });

  it("is deterministic for the same advances", () => {
    const p = program([
      {
        id: "a",
        trigger: flag,
        statements: [
          {
            type: "repeat",
            count: 5,
            body: [
              { type: "move", steps: 3 },
              { type: "wait", seconds: 0.1 },
            ],
          },
        ],
      },
    ]);
    const once = () => {
      const live = createLiveRuntime(p);
      live.fire({ type: "start" });
      run(live, 2);
      return JSON.stringify(live.result());
    };
    expect(once()).toBe(once());
  });

  it("records the inputs it read and rebuilds the exact same run from them", () => {
    const p = program([
      {
        id: "a",
        trigger: flag,
        statements: [
          {
            type: "forever",
            body: [
              { type: "move", steps: 1 },
              { type: "wait", seconds: 0.1 },
            ],
          },
        ],
      },
      {
        id: "k",
        trigger: { type: "onKeyPressed", key: "ArrowUp" },
        statements: [{ type: "turn", degrees: 90 }],
      },
      {
        id: "m",
        trigger: { type: "onKeyPressed", key: "Space" },
        statements: [{ type: "glideTo", x: 100, y: 20, seconds: 0.5 }],
      },
    ]);
    let keys: string[] = [];
    let pointer = { x: 0, y: 0, down: false };
    const live = createLiveRuntime(
      p,
      {},
      { keysDown: () => keys, pointer: () => pointer, randomSeed: 7 },
    );
    live.fire({ type: "start" });
    run(live, 0.4);
    keys = ["ArrowUp"];
    live.fire({ type: "keyPressed", key: "ArrowUp" });
    pointer = { x: 10, y: 5, down: true };
    run(live, 0.3);
    keys = [];
    live.fire({ type: "keyPressed", key: "Space" });
    run(live, 1.2);
    const log = live.inputLog();
    expect(log.inputs.map((input) => input.kind)).toEqual(
      expect.arrayContaining(["event", "keys", "pointer"]),
    );
    const again = replayLiveRuntime(p, {}, log);
    expect(JSON.stringify(again.result())).toBe(JSON.stringify(live.result()));
    expect(JSON.stringify(again.inputLog())).toBe(JSON.stringify(log));
  });

  it("stamps how long a wait or glide took on its trace entry", () => {
    const p = program([
      {
        id: "a",
        trigger: flag,
        statements: [
          { type: "glideTo", x: 40, y: 0, seconds: 1 },
          { type: "move", steps: 1 },
        ],
      },
    ]);
    const live = createLiveRuntime(p);
    live.fire({ type: "start" });
    run(live, 2);
    const [glide, move] = live.result().trace;
    expect(glide!.seconds).toBe(1);
    expect(move!.seconds).toBeUndefined();
  });

  it("carries a glide tick by tick and draws its pen trail as it goes", () => {
    const p = penProgram([
      {
        id: "a",
        trigger: flag,
        statements: [
          { type: "penDown" },
          { type: "glideTo", x: 100, y: 0, seconds: 1 },
          { type: "move", steps: 0 },
        ],
      },
    ]);
    const live = createLiveRuntime(p);
    live.fire({ type: "start" });
    run(live, 0.5);
    const half = live.result().actors[0]!.world;
    expect(half.sprite.x).toBeGreaterThan(30);
    expect(half.sprite.x).toBeLessThan(70);
    const trail = half.pen?.segments ?? [];
    expect(Math.max(...trail.map((segment) => segment.x2))).toBeCloseTo(half.sprite.x, 0);
    run(live, 1);
    const end = live.result().actors[0]!.world;
    expect(end.sprite.x).toBe(100);
    expect(Math.max(...(end.pen?.segments ?? []).map((segment) => segment.x2))).toBe(100);
  });
});
