import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  type ProjectCreativeState,
  type ProjectProgram,
  type Statement,
} from "@agorix/program-model";
import { createLiveRuntime, LIVE_TICK_SECONDS, replayLiveRuntime } from "./liveRuntime.js";
import { runMultiActorProgram } from "./multiActor.js";

const creative: ProjectCreativeState = {
  actors: [
    {
      id: "actor:studio-1-nova",
      name: "Nova",
      x: 100,
      y: 0,
      direction: 0,
      size: 100,
      visible: true,
      scripts: ["studio-actor-1-nova"],
    },
  ],
};

const program = (
  main: Statement[],
  copy: Statement[],
  extra: ProjectProgram["scripts"] = [],
): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [
    { id: "studio-actor-1-nova", trigger: { type: "greenFlag" }, statements: main },
    { id: "studio-actor-1-nova-clone", trigger: { type: "onCloneStart" }, statements: copy },
    ...extra,
  ],
});

describe("copies that run their own script (#1311), batch runner", () => {
  it("starts the copy script once for each copy, each as its own character, from the parent's place", () => {
    const run = runMultiActorProgram(
      program(
        [{ type: "createCopies", count: 3, rule: "spread", withScript: true }],
        [{ type: "move", steps: 20 }, { type: "deleteThisClone" }],
      ),
      creative,
    );
    expect(run.activations.map((item) => `${item.actorId}:${item.scriptId}`)).toEqual([
      "actor:studio-1-nova:studio-actor-1-nova",
      "actor:studio-1-nova#1:studio-actor-1-nova-clone",
      "actor:studio-1-nova#2:studio-actor-1-nova-clone",
      "actor:studio-1-nova#3:studio-actor-1-nova-clone",
    ]);
    // The first frame of each copy shows it where the spread rule put it, around the parent.
    const startX = (id: string) =>
      run.trace.find((entry) => entry.actorId === id)!.worldBefore.sprite.x;
    expect([1, 2, 3].map((n) => startX(`actor:studio-1-nova#${n}`))).toEqual([60, 100, 140]);
    // Each copy ended itself: only the character is left, and the run did not count that as a stop.
    expect(run.actors.map((actor) => actor.id)).toEqual(["actor:studio-1-nova"]);
    expect(run.stage.actorOrder).toEqual(["actor:studio-1-nova"]);
    expect(run.outcome).toBe("completed");
    // While they lived, frames hold the copies as characters of their own.
    expect(run.frames.some((frame) => frame.actors.some((actor) => actor.id.endsWith("#2")))).toBe(
      true,
    );
  });

  it("keeps a copy that never ends, and is deterministic", () => {
    const p = program(
      [{ type: "createCopies", count: 2, rule: "fall", withScript: true }],
      [{ type: "move", steps: 20 }],
    );
    const a = runMultiActorProgram(p, creative);
    const b = runMultiActorProgram(p, creative);
    expect(a.actors.map((actor) => actor.id)).toEqual([
      "actor:studio-1-nova",
      "actor:studio-1-nova#1",
      "actor:studio-1-nova#2",
    ]);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it("holds at most 20 live copies of either kind and says so", () => {
    const make: Statement = { type: "createCopies", count: 10, rule: "spread", withScript: true };
    const run = runMultiActorProgram(program([make, make, make], []), creative);
    expect(run.actors).toHaveLength(21);
    expect(run.trace.filter((entry) => entry.note?.includes("limit of 20"))).toHaveLength(1);
    // Plain copies share the cap with them.
    const mixed = runMultiActorProgram(
      program(
        [
          { type: "createCopies", count: 10, rule: "spread", withScript: true },
          { type: "createCopies", count: 10, rule: "spread", withScript: true },
          { type: "createCopies", count: 5, rule: "fall" },
        ],
        [],
      ),
      creative,
    );
    expect(mixed.actors.length - 1 + (mixed.actors[0]!.world.copies?.length ?? 0)).toBe(20);
  });

  it("lets a copy hear a message and make copies of itself, still counted from the same run", () => {
    const run = runMultiActorProgram(
      program(
        [{ type: "createCopies", count: 1, rule: "spread", withScript: true }],
        [{ type: "createCopies", count: 1, rule: "spread", withScript: true }],
      ),
      creative,
      { maxSteps: 50 },
    );
    // Each copy makes one more, until the cap or the budget ends it.
    expect(run.actors.length).toBeGreaterThan(2);
    expect(run.actors.length).toBeLessThanOrEqual(21);
    expect(run.actors.map((actor) => actor.id)[1]).toBe("actor:studio-1-nova#1");
  });

  it("does nothing special for a program without a copy script", () => {
    const run = runMultiActorProgram(
      {
        schema: SCHEMA_VERSION,
        scripts: [
          {
            id: "studio-actor-1-nova",
            trigger: { type: "greenFlag" },
            statements: [{ type: "createCopies", count: 2, rule: "spread", withScript: true }],
          },
        ],
      },
      creative,
    );
    // The copies exist as characters but have nothing to run.
    expect(run.actors).toHaveLength(3);
    expect(run.activations).toHaveLength(1);
  });
});

describe("copies that run their own script (#1311), live runtime", () => {
  const p = (statementsMain: Statement[], copy: Statement[]) => program(statementsMain, copy);
  const play = (live: ReturnType<typeof createLiveRuntime>, seconds: number) => {
    for (let t = 0; t < seconds; t += LIVE_TICK_SECONDS) live.advance(LIVE_TICK_SECONDS);
  };

  it("runs each copy's script in time beside the character, then removes the ones that end", () => {
    const live = createLiveRuntime(
      p(
        [{ type: "createCopies", count: 2, rule: "spread", withScript: true }],
        [{ type: "move", steps: 20 }, { type: "wait", seconds: 1 }, { type: "deleteThisClone" }],
      ),
      creative,
    );
    live.fire({ type: "start" });
    play(live, 0.5);
    expect(live.result().actors.map((actor) => actor.id)).toEqual([
      "actor:studio-1-nova",
      "actor:studio-1-nova#1",
      "actor:studio-1-nova#2",
    ]);
    expect(live.running).toBe(true);
    play(live, 2);
    expect(live.result().actors.map((actor) => actor.id)).toEqual(["actor:studio-1-nova"]);
    expect(live.running).toBe(false);
    expect(live.result().outcome).toBe("completed");
  });

  it("holds the shared cap of 20", () => {
    const make: Statement = { type: "createCopies", count: 10, rule: "spread", withScript: true };
    const live = createLiveRuntime(p([make, make, make], [{ type: "wait", seconds: 5 }]), creative);
    live.fire({ type: "start" });
    play(live, 1);
    expect(live.result().actors).toHaveLength(21);
  });

  it("replays exactly from the input log, copies included", () => {
    const prog = p(
      [{ type: "createCopies", count: 3, rule: "fall", withScript: true }],
      [{ type: "move", steps: 20 }, { type: "wait", seconds: 0.5 }, { type: "deleteThisClone" }],
    );
    const live = createLiveRuntime(prog, creative);
    live.fire({ type: "start" });
    play(live, 3);
    const replay = replayLiveRuntime(prog, creative, live.inputLog());
    play(replay, 3.1);
    expect(JSON.stringify(replay.result().actors)).toBe(JSON.stringify(live.result().actors));
    expect(replay.result().trace.length).toBe(live.result().trace.length);
  });
});
