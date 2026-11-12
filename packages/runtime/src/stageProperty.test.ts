import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  STAGE_ACTOR_ID,
  validateProgram,
  type ProjectCreativeState,
  type ProjectProgram,
} from "@agorix/program-model";
import { runMultiActorProgram } from "./index.js";

const program: ProjectProgram = {
  schema: SCHEMA_VERSION,
  variables: [
    { id: "number", name: "number", initialValue: 0, visible: true },
    { id: "volume", name: "volume", initialValue: 0, visible: true },
  ],
  textVariables: [{ id: "name", name: "name", initialValue: "", visible: true }],
  scripts: [
    {
      id: "switch",
      trigger: { type: "greenFlag" },
      statements: [{ type: "switchBackdrop", backdropId: "backdrop:night" }],
    },
    {
      id: "read",
      trigger: { type: "greenFlag" },
      statements: [
        {
          type: "setVariable",
          variableId: "number",
          value: { type: "actorProperty", actorId: STAGE_ACTOR_ID, property: "backdropNumber" },
        },
        {
          type: "setVariable",
          variableId: "volume",
          value: { type: "actorProperty", actorId: STAGE_ACTOR_ID, property: "volume" },
        },
        {
          type: "setText",
          variableId: "name",
          value: { type: "actorProperty", actorId: STAGE_ACTOR_ID, property: "backdropName" },
        },
      ],
    },
  ],
};

const creative: ProjectCreativeState = {
  stage: { actorOrder: ["switcher", "reader"], backdropId: "backdrop:day" },
  actors: [
    {
      id: "switcher",
      name: "Switcher",
      x: 0,
      y: 0,
      direction: 0,
      size: 100,
      visible: true,
      scripts: ["switch"],
    },
    {
      id: "reader",
      name: "Reader",
      x: 0,
      y: 0,
      direction: 0,
      size: 100,
      visible: true,
      scripts: ["read"],
    },
  ],
  assets: [
    { id: "backdrop:day", kind: "backdrop", name: "Day", source: "gallery:day" },
    { id: "backdrop:night", kind: "backdrop", name: "Night", source: "gallery:night" },
  ],
  backdropOrder: ["backdrop:day", "backdrop:night"],
};

describe("property of Stage", () => {
  it("reads the backdrop switched by another character", () => {
    const result = runMultiActorProgram(program, creative);
    const world = result.actors.find((actor) => actor.id === "reader")?.world;
    expect(world?.variables?.number?.value).toBe(2);
    expect(world?.variables?.volume?.value).toBe(100);
    expect(world?.texts?.name?.value).toBe("Night");
  });

  it("rejects Stage-only properties on a character and character-only properties on Stage", () => {
    for (const [actorId, property] of [
      ["reader", "backdropName"],
      [STAGE_ACTOR_ID, "xPosition"],
      [STAGE_ACTOR_ID, "variable"],
    ]) {
      expect(() =>
        validateProgram({
          ...program,
          scripts: [
            {
              ...program.scripts[1]!,
              statements: [
                {
                  type: "setVariable",
                  variableId: "number",
                  value: { type: "actorProperty", actorId, property },
                },
              ],
            },
          ],
        }),
      ).toThrow();
    }
  });
});
