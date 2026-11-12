import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  validateProgram,
  type ActorProperty,
  type ProjectCreativeState,
  type ProjectProgram,
  type Statement,
} from "@agorix/program-model";
import { createWorldState, runMultiActorProgram, runProgram } from "./index.js";

const friend = "actor:friend";
const hero = "actor:hero";
const read = (property: ActorProperty, variableId: string, sourceId?: string): Statement => ({
  type: "setVariable",
  variableId,
  value: {
    type: "actorProperty",
    actorId: friend,
    property,
    ...(sourceId === undefined ? {} : { variableId: sourceId }),
  },
});
const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  variables: [
    { id: "source", name: "source", initialValue: 3, visible: true },
    ...["x", "y", "direction", "size", "costume", "volume", "value"].map((id) => ({
      id,
      name: id,
      initialValue: 0,
      visible: true,
    })),
  ],
  textVariables: [{ id: "name", name: "name", initialValue: "", visible: true }],
  scripts: [
    {
      id: "friend-script",
      trigger: { type: "greenFlag" },
      statements: [
        { type: "goTo", x: 34, y: -7 },
        { type: "setVolume", volume: 42 },
        { type: "setVariable", variableId: "source", value: { type: "numericLiteral", value: 11 } },
      ],
    },
    {
      id: "hero-script",
      trigger: { type: "greenFlag" },
      statements: [
        read("xPosition", "x"),
        read("yPosition", "y"),
        read("direction", "direction"),
        read("size", "size"),
        read("costumeNumber", "costume"),
        read("volume", "volume"),
        read("variable", "value", "source"),
        {
          type: "setText",
          variableId: "name",
          value: { type: "actorProperty", actorId: friend, property: "costumeName" },
        },
      ],
    },
  ],
};
const scene: ProjectCreativeState = {
  actors: [
    {
      id: friend,
      name: "Friend",
      x: 0,
      y: 0,
      direction: 35,
      size: 135,
      visible: true,
      costumeId: "costume:blue",
      scripts: ["friend-script"],
    },
    {
      id: hero,
      name: "Hero",
      x: 0,
      y: 0,
      direction: 0,
      size: 100,
      visible: true,
      scripts: ["hero-script"],
    },
  ],
  stage: { actorOrder: [friend, hero] },
  assets: [{ id: "costume:blue", kind: "costume", name: "Blue", source: "gallery:blue" }],
  costumeOrders: { [friend]: ["costume:blue"] },
};

describe("property of another actor", () => {
  it("reads the target's executed state and its declared variable", () => {
    const result = runMultiActorProgram(program, scene);
    const world = result.actors.find((actor) => actor.id === hero)?.world;
    expect(
      Object.fromEntries(
        Object.entries(world?.variables ?? {}).map(([id, entry]) => [id, entry.value]),
      ),
    ).toMatchObject({
      x: 34,
      y: -7,
      direction: 35,
      size: 135,
      costume: 1,
      volume: 42,
      value: 11,
    });
    expect(world?.texts?.name?.value).toBe("Blue");
  });

  it("reads initial values when the target has not run yet", () => {
    const before = runMultiActorProgram(program, {
      ...scene,
      stage: { actorOrder: [hero, friend] },
    });
    const world = before.actors.find((actor) => actor.id === hero)?.world;
    expect(world?.variables?.value?.value).toBe(3);
    expect(world?.variables?.volume?.value).toBe(100);
  });

  it("returns zero for an absent actor and rejects unknown properties and variables", () => {
    expect(runProgram(program, createWorldState()).world.variables?.x?.value).toBe(0);
    for (const value of [
      { type: "actorProperty", actorId: friend, property: "private" },
      { type: "actorProperty", actorId: friend, property: "variable", variableId: "missing" },
      { type: "actorProperty", actorId: "", property: "xPosition" },
    ]) {
      const malformed = {
        ...program,
        scripts: [
          { ...program.scripts[0]!, statements: [{ type: "setVariable", variableId: "x", value }] },
        ],
      };
      expect(() => validateProgram(malformed)).toThrow();
    }
  });
});
