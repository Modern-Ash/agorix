import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  validateProgram,
  type ProjectCreativeState,
  type ProjectProgram,
  type Statement,
} from "@agorix/program-model";
import { createWorldState, runMultiActorProgram, runProgram } from "./index.js";

// Going to, and gliding to, another character (Scratch: go to / glide to [sprite]).
const program = (statement: Statement): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [
    { id: "a", trigger: { type: "greenFlag" }, statements: [statement] },
    { id: "b", trigger: { type: "onMessage", message: "nunca" }, statements: [] },
  ],
});
const creative: ProjectCreativeState = {
  actors: [
    {
      id: "actor:a",
      name: "A",
      x: 10,
      y: 10,
      direction: 0,
      size: 100,
      visible: true,
      scripts: ["a"],
    },
    {
      id: "actor:b",
      name: "B",
      x: 250,
      y: 60,
      direction: 0,
      size: 100,
      visible: true,
      scripts: ["b"],
    },
  ],
};

describe("go to another character", () => {
  it("moves the character to where the other one is", () => {
    const run = runMultiActorProgram(
      program({ type: "goToTarget", target: "actor", actorId: "actor:b" }),
      creative,
    );
    expect(run.actors[0]!.world.sprite).toMatchObject({ x: 250, y: 60 });
    // The other character stays where it was.
    expect(run.actors[1]!.world.sprite).toMatchObject({ x: 250, y: 60 });
  });

  it("takes its seconds on the run's clock when it is a glide, and goes there all the same", () => {
    const others = [{ id: "actor:b", x: 250, y: 60, visible: true }];
    const run = (seconds?: number) =>
      runProgram(
        program({
          type: "goToTarget",
          target: "actor",
          actorId: "actor:b",
          ...(seconds === undefined ? {} : { seconds }),
        }),
        createWorldState(),
        { sensorActors: others },
      );
    expect(run().virtualSeconds).toBeUndefined();
    const glide = run(2);
    expect(glide.virtualSeconds).toBe(2);
    expect(glide.world.sprite).toMatchObject({ x: 250, y: 60 });
  });

  it("glides to the mouse and to a random spot too", () => {
    const toMouse = runMultiActorProgram(
      program({ type: "goToTarget", target: "mouse", seconds: 1 }),
      creative,
      { pointer: { x: 100, y: 20, down: false } },
    );
    expect(toMouse.actors[0]!.world.sprite).toMatchObject({ x: 100, y: 20 });
  });

  it("says so and stays put when the other character is not on the stage", () => {
    const run = runProgram(
      program({ type: "goToTarget", target: "actor", actorId: "actor:nobody" }),
      createWorldState(),
      { sensorActors: [] },
    );
    expect(run.world.sprite).toMatchObject({ x: 0, y: 0 });
    expect(run.outcome).toBe("completed");
    expect(JSON.stringify(run.notes)).toContain("no actor actor:nobody");
  });
});

describe("go to a character, as a program", () => {
  const check = (statement: unknown) =>
    validateProgram({
      schema: SCHEMA_VERSION,
      scripts: [{ id: "a", trigger: { type: "onStart" }, statements: [statement] }],
    });

  it("is valid only with the right fields", () => {
    expect(() => check({ type: "goToTarget", target: "actor", actorId: "actor:b" })).not.toThrow();
    expect(() => check({ type: "goToTarget", target: "mouse", seconds: 1 })).not.toThrow();
    for (const bad of [
      { type: "goToTarget", target: "actor" },
      { type: "goToTarget", target: "actor", actorId: "" },
      { type: "goToTarget", target: "mouse", actorId: "actor:b" },
      { type: "goToTarget", target: "somewhere" },
      { type: "goToTarget", target: "random", seconds: "fast" },
      { type: "goToTarget", target: "random", seconds: 11 },
    ])
      expect(() => check(bad), JSON.stringify(bad)).toThrow();
  });
});
