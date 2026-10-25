import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  type ProjectCreativeState,
  type ProjectProgram,
} from "@agorix/program-model";
import { RuntimeSession } from "./index.js";

const counter: ProjectProgram = {
  schema: SCHEMA_VERSION,
  variables: [{ id: "score", name: "score", initialValue: 0, visible: true }],
  lists: [{ id: "log", name: "log", initialItems: [], visible: false }],
  scripts: [
    {
      id: "count",
      trigger: { type: "onStart" },
      statements: [
        {
          type: "changeVariable",
          variableId: "score",
          delta: { type: "numericLiteral", value: 1 },
        },
        {
          type: "listAdd",
          listId: "log",
          value: { type: "variable", variableId: "score" },
        },
        { type: "move", steps: 2 },
      ],
    },
  ],
};

describe("RuntimeSession", () => {
  it("keeps variables, lists and position across frames", () => {
    const session = new RuntimeSession({ program: counter });

    session.step([{ type: "start" }]);
    expect(session.snapshot().actors[0]?.world.variables?.["score"]?.value).toBe(1);
    expect(session.snapshot().actors[0]?.world.lists?.["log"]?.items).toEqual([1]);
    expect(session.snapshot().actors[0]?.world.sprite.x).toBe(2);

    session.step([{ type: "start" }]);
    expect(session.snapshot().actors[0]?.world.variables?.["score"]?.value).toBe(2);
    expect(session.snapshot().actors[0]?.world.lists?.["log"]?.items).toEqual([1, 2]);
    expect(session.snapshot().actors[0]?.world.sprite.x).toBe(4);
  });

  it("restores a snapshot to the exact same digest and continues deterministically", () => {
    const session = new RuntimeSession({ program: counter });
    session.step([{ type: "start" }]);
    session.step([{ type: "start" }]);
    const snapshot = JSON.parse(JSON.stringify(session.snapshot())) as unknown;
    const digestAtTwo = session.digest();

    session.step([{ type: "start" }]);
    expect(session.digest()).not.toBe(digestAtTwo);

    session.restore(snapshot);
    expect(session.digest()).toBe(digestAtTwo);
    session.step([{ type: "start" }]);

    const replay = new RuntimeSession({ program: counter });
    replay.step([{ type: "start" }]);
    replay.step([{ type: "start" }]);
    replay.step([{ type: "start" }]);
    expect(session.digest()).toBe(replay.digest());
  });

  it("carries the PRNG stream across frames", () => {
    const randomProgram: ProjectProgram = {
      schema: SCHEMA_VERSION,
      variables: [{ id: "roll", name: "roll", initialValue: 0, visible: true }],
      scripts: [
        {
          id: "roll-script",
          trigger: { type: "onStart" },
          statements: [
            {
              type: "setVariable",
              variableId: "roll",
              value: {
                type: "random",
                min: { type: "numericLiteral", value: 1 },
                max: { type: "numericLiteral", value: 1000 },
              },
            },
            {
              type: "changeVariable",
              variableId: "roll",
              delta: { type: "variable", variableId: "roll" },
            },
          ],
        },
      ],
    };
    const a = new RuntimeSession({ program: randomProgram, randomSeed: 42 });
    const b = new RuntimeSession({ program: randomProgram, randomSeed: 42 });
    for (let i = 0; i < 3; i += 1) {
      a.step([{ type: "start" }]);
      b.step([{ type: "start" }]);
    }
    expect(a.digest()).toBe(b.digest());
    expect(a.snapshot().actors[0]?.world.variables?.["roll"]?.value).toBeGreaterThan(0);
  });

  it("keeps the stage actor order produced by goToLayer", () => {
    const orderProgram: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "front",
          trigger: { type: "onStart" },
          statements: [{ type: "goToLayer", layer: "front" }],
        },
        {
          id: "move",
          trigger: { type: "onStart" },
          statements: [{ type: "move", steps: 1 }],
        },
      ],
    };
    const creative: ProjectCreativeState = {
      actors: [
        {
          id: "actor:a",
          name: "A",
          x: 0,
          y: 0,
          direction: 0,
          size: 100,
          visible: true,
          scripts: ["front"],
        },
        {
          id: "actor:b",
          name: "B",
          x: 0,
          y: 0,
          direction: 0,
          size: 100,
          visible: true,
          scripts: ["move"],
        },
      ],
      stage: { actorOrder: ["actor:a", "actor:b"] },
    };
    const session = new RuntimeSession({ program: orderProgram, creative });

    expect(session.step([{ type: "start" }]).trace.map((entry) => entry.actorId)).toEqual([
      "actor:a",
      "actor:b",
    ]);
    expect(session.snapshot().stage.actorOrder).toEqual(["actor:b", "actor:a"]);
    expect(session.step([{ type: "start" }]).trace.map((entry) => entry.actorId)).toEqual([
      "actor:b",
      "actor:a",
    ]);
  });

  it("rejects a malformed snapshot without changing the current state", () => {
    const session = new RuntimeSession({ program: counter });
    session.step([{ type: "start" }]);
    const before = session.digest();
    expect(() => session.restore({ version: 1, stage: {}, actors: [] })).toThrow(RangeError);
    expect(() => session.restore({ version: 99, stage: { actorOrder: [] }, actors: [] })).toThrow(
      RangeError,
    );
    expect(session.digest()).toBe(before);
  });
});
