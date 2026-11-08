import { describe, expect, it } from "vitest";
import { SCHEMA_VERSION, type ProjectProgram, type Statement } from "@agorix/program-model";
import { COPIES_CAP, createWorldState, runProgram } from "./index.js";
import { createLiveRuntime, LIVE_TICK_SECONDS } from "./liveRuntime.js";
import { runMultiActorProgram } from "./multiActor.js";

const program = (statements: Statement[]): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [{ id: "main", trigger: { type: "greenFlag" }, statements }],
});

function live(statements: Statement[], seconds: number) {
  const runtime = createLiveRuntime(program(statements));
  runtime.fire({ type: "start" });
  for (let t = 0; t < seconds; t += LIVE_TICK_SECONDS) runtime.advance(LIVE_TICK_SECONDS);
  return runtime.result().actors[0]!.world;
}

describe("copies of a character", () => {
  it("makes a row, centred on the character, for 'spread'", () => {
    const world = runProgram(
      program([{ type: "createCopies", count: 3, rule: "spread" }]),
      createWorldState({ sprite: { x: 100, y: 20, heading: 0 } }),
    ).world;
    expect(world.copies!.map((copy) => [copy.x, copy.y])).toEqual([
      [60, 20],
      [100, 20],
      [140, 20],
    ]);
  });

  it("starts falling copies at the top and followers on the character", () => {
    const fall = runProgram(
      program([{ type: "createCopies", count: 3, rule: "fall" }]),
      createWorldState(),
    ).world;
    expect(fall.copies!.every((copy) => copy.y === -100)).toBe(true);
    expect(fall.copies!.map((copy) => copy.x)).toEqual([80, 160, 240]);
    const follow = runProgram(
      program([{ type: "createCopies", count: 2, rule: "follow" }]),
      createWorldState({ sprite: { x: 50, y: 10, heading: 0 } }),
    ).world;
    expect(follow.copies!.map((copy) => [copy.x, copy.y])).toEqual([
      [50, 10],
      [50, 10],
    ]);
  });

  it("leaves a world that never made copies exactly as it was", () => {
    const world = runProgram(program([{ type: "move", steps: 40 }]), createWorldState()).world;
    expect("copies" in world).toBe(false);
  });

  it("keeps at most the cap in a run, however many are asked for", () => {
    const many = Array.from({ length: 6 }, () => ({
      type: "createCopies" as const,
      count: 5,
      rule: "spread" as const,
    }));
    expect(runProgram(program(many), createWorldState()).world.copies).toHaveLength(COPIES_CAP);
    const run = runMultiActorProgram(program(many));
    expect(run.actors[0]!.world.copies).toHaveLength(COPIES_CAP);
    expect(live(many, 0.5).copies).toHaveLength(COPIES_CAP);
  });

  it("counts the cap across characters, not per character", () => {
    const two: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "a",
          trigger: { type: "greenFlag" },
          statements: Array.from({ length: 3 }, () => ({
            type: "createCopies" as const,
            count: 5,
            rule: "spread" as const,
          })),
        },
        {
          id: "b",
          trigger: { type: "greenFlag" },
          statements: Array.from({ length: 3 }, () => ({
            type: "createCopies" as const,
            count: 5,
            rule: "spread" as const,
          })),
        },
      ],
    };
    const creative = {
      actors: ["a", "b"].map((id) => ({
        id: `actor:${id}`,
        name: id,
        x: 0,
        y: 0,
        direction: 0,
        size: 100,
        visible: true,
        scripts: [id],
      })),
    };
    const runtime = createLiveRuntime(two, creative);
    runtime.fire({ type: "start" });
    for (let t = 0; t < 1; t += LIVE_TICK_SECONDS) runtime.advance(LIVE_TICK_SECONDS);
    const total = runtime
      .result()
      .actors.reduce((sum, actor) => sum + (actor.world.copies?.length ?? 0), 0);
    expect(total).toBeLessThanOrEqual(COPIES_CAP);
    expect(total).toBeGreaterThan(0);
  });

  it("live: falling copies fall with time and land at the bottom", () => {
    const mid = live(
      [
        { type: "createCopies", count: 2, rule: "fall" },
        { type: "wait", seconds: 5 },
      ],
      0.5,
    );
    expect(mid.copies![0]!.y).toBeGreaterThan(-100);
    expect(mid.copies![0]!.y).toBeLessThan(120);
    const landed = live(
      [
        { type: "createCopies", count: 2, rule: "fall" },
        { type: "wait", seconds: 5 },
      ],
      3,
    );
    expect(landed.copies!.every((copy) => copy.y === 120)).toBe(true);
  });

  it("live: followers close in on the character and keep their gap", () => {
    const world = live(
      [
        { type: "createCopies", count: 2, rule: "follow" },
        { type: "setX", x: 200 },
        { type: "wait", seconds: 5 },
      ],
      3,
    );
    const [near, far] = world.copies!;
    expect(Math.hypot(200 - near!.x, world.sprite.y - near!.y)).toBeCloseTo(30, 0);
    expect(Math.hypot(200 - far!.x, world.sprite.y - far!.y)).toBeCloseTo(60, 0);
  });

  it("is deterministic: the same program and ticks give the same copies", () => {
    const statements: Statement[] = [
      { type: "createCopies", count: 3, rule: "fall" },
      { type: "wait", seconds: 2 },
    ];
    expect(JSON.stringify(live(statements, 1.2))).toBe(JSON.stringify(live(statements, 1.2)));
  });

  it("an instant run shows them finished: landed, and trailing behind", () => {
    const run = runMultiActorProgram(
      program([
        { type: "createCopies", count: 2, rule: "fall" },
        { type: "createCopies", count: 2, rule: "follow" },
        { type: "move", steps: 100 },
      ]),
    );
    const copies = run.actors[0]!.world.copies!;
    expect(copies.filter((copy) => copy.rule === "fall").every((copy) => copy.y === 120)).toBe(
      true,
    );
    const followers = copies.filter((copy) => copy.rule === "follow");
    expect(followers.map((copy) => Math.round(run.actors[0]!.world.sprite.x - copy.x))).toEqual([
      30, 60,
    ]);
  });

  it("live: the run keeps going while copies are still on their way, then ends", () => {
    const runtime = createLiveRuntime(program([{ type: "createCopies", count: 2, rule: "fall" }]));
    runtime.fire({ type: "start" });
    runtime.advance(LIVE_TICK_SECONDS * 3);
    // The script is done after one statement, but the copies have not landed.
    expect(runtime.running).toBe(true);
    for (let t = 0; t < 3; t += LIVE_TICK_SECONDS) runtime.advance(LIVE_TICK_SECONDS);
    expect(runtime.running).toBe(false);
    expect(runtime.result().actors[0]!.world.copies!.every((copy) => copy.y === 120)).toBe(true);
  });
});
