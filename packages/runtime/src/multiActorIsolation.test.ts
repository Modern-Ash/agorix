import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  type ProjectActor,
  type ProjectCreativeState,
  type ProjectProgram,
} from "@agorix/program-model";
import { runMultiActorProgram } from "./index.js";

// Issue #469: the handoff 6f cases, pinned against the real runtime.
const actor = (id: string, x: number, scripts: string[], costumeId?: string): ProjectActor => ({
  id,
  name: id,
  x,
  y: 0,
  direction: 0,
  size: 100,
  visible: true,
  scripts,
  ...(costumeId === undefined ? {} : { costumeId }),
});

describe("multi-actor isolation (issue #469)", () => {
  it("two actors with their own move 1 advance one cell each, without interfering", () => {
    const program: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        { id: "a", trigger: { type: "onStart" }, statements: [{ type: "move", steps: 1 }] },
        { id: "b", trigger: { type: "onStart" }, statements: [{ type: "move", steps: 1 }] },
      ],
    };
    const creative: ProjectCreativeState = {
      actors: [actor("actor:a", 0, ["a"]), actor("actor:b", 10, ["b"])],
    };
    const result = runMultiActorProgram(program, creative);
    const byId = Object.fromEntries(result.actors.map((item) => [item.id, item.world.sprite]));
    expect(byId["actor:a"]).toMatchObject({ x: 1, y: 0 });
    expect(byId["actor:b"]).toMatchObject({ x: 11, y: 0 });
  });

  it("one shared script gives each actor its own state", () => {
    const program: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "shared",
          trigger: { type: "onStart" },
          statements: [
            { type: "move", steps: 1 },
            { type: "turn", degrees: 90 },
          ],
        },
      ],
    };
    const creative: ProjectCreativeState = {
      actors: [actor("actor:a", 0, ["shared"]), actor("actor:b", 10, ["shared"])],
    };
    const result = runMultiActorProgram(program, creative);
    expect(
      result.actors.map((item) => [item.id, item.world.sprite.x, item.world.sprite.heading]),
    ).toEqual([
      ["actor:a", 1, 90],
      ["actor:b", 11, 90],
    ]);
  });

  it("switching to costume 2 of 3 shows costume 2 and leaves other actors alone", () => {
    const assets = ["c1", "c2", "c3"].map((id) => ({
      id,
      kind: "costume" as const,
      name: id,
      source: `builtin:${id}`,
    }));
    const program: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "look",
          trigger: { type: "onStart" },
          statements: [{ type: "switchCostume", costumeId: "c2" }],
        },
        { id: "idle", trigger: { type: "onStart" }, statements: [{ type: "move", steps: 1 }] },
      ],
    };
    const creative: ProjectCreativeState = {
      assets,
      actors: [actor("actor:a", 0, ["look"], "c1"), actor("actor:b", 5, ["idle"], "c3")],
    };
    const result = runMultiActorProgram(program, creative);
    const byId = Object.fromEntries(result.actors.map((item) => [item.id, item.world.sprite]));
    expect(byId["actor:a"]?.costumeId).toBe("c2");
    expect(byId["actor:b"]?.costumeId).toBe("c3");
    expect(
      result.frames[0]?.actors.find((item) => item.id === "actor:a")?.world.sprite.costumeId,
    ).toBe("c2");
  });

  it("rejects switching to a costume that does not exist", () => {
    const program: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "look",
          trigger: { type: "onStart" },
          statements: [{ type: "switchCostume", costumeId: "ghost" }],
        },
      ],
    };
    const creative: ProjectCreativeState = {
      assets: [{ id: "c1", kind: "costume", name: "c1", source: "builtin:c1" }],
      actors: [actor("actor:a", 0, ["look"], "c1")],
    };
    expect(() => runMultiActorProgram(program, creative)).toThrow();
  });

  it("a broadcast reaches both receiving actors exactly once, in stage order", () => {
    const program: ProjectProgram = {
      schema: SCHEMA_VERSION,
      scripts: [
        {
          id: "sender",
          trigger: { type: "onStart" },
          statements: [{ type: "broadcast", message: "go" }],
        },
        {
          id: "recv-a",
          trigger: { type: "onMessage", message: "go" },
          statements: [{ type: "move", steps: 1 }],
        },
        {
          id: "recv-b",
          trigger: { type: "onMessage", message: "go" },
          statements: [{ type: "move", steps: 2 }],
        },
      ],
    };
    const creative: ProjectCreativeState = {
      actors: [
        actor("actor:s", 0, ["sender"]),
        actor("actor:a", 0, ["recv-a"]),
        actor("actor:b", 0, ["recv-b"]),
      ],
      stage: { actorOrder: ["actor:s", "actor:b", "actor:a"] },
    };
    const result = runMultiActorProgram(program, creative);
    const received = result.activations.filter((item) => item.event.type === "message");
    expect(received.map((item) => item.scriptId)).toEqual(["recv-b", "recv-a"]);
    const byId = Object.fromEntries(result.actors.map((item) => [item.id, item.world.sprite.x]));
    expect(byId).toEqual({ "actor:s": 0, "actor:a": 1, "actor:b": 2 });
    expect(
      JSON.stringify(runMultiActorProgram(structuredClone(program), structuredClone(creative))),
    ).toBe(JSON.stringify(result));
  });
});
