import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  validateProgram,
  type ProjectCreativeState,
  type ProjectProgram,
} from "@agorix/program-model";
import { runMultiActorProgram, runProgram, createWorldState } from "./index.js";

const hero = "actor:hero";
const friend = "actor:friend";

function sensingProgram(): ProjectProgram {
  return {
    schema: SCHEMA_VERSION,
    variables: [
      { id: "x", name: "X", initialValue: 0, visible: true },
      { id: "y", name: "Y", initialValue: 0, visible: true },
    ],
    scripts: [
      {
        id: "hero",
        trigger: { type: "greenFlag" },
        statements: [
          { type: "goTo", x: 20, y: 10 },
          { type: "setVariable", variableId: "x", value: { type: "xPosition" } },
          { type: "setVariable", variableId: "y", value: { type: "yPosition" } },
          {
            type: "if",
            condition: { type: "touchingActor", actorId: friend },
            then: [{ type: "say", text: "juntos" }],
            else: [{ type: "say", text: "lejos" }],
          },
        ],
      },
    ],
  };
}

function scene(friendX: number, visible = true): ProjectCreativeState {
  return {
    actors: [
      {
        id: hero,
        name: "Hero",
        x: 0,
        y: 0,
        direction: 0,
        size: 100,
        visible: true,
        scripts: ["hero"],
      },
      {
        id: friend,
        name: "Friend",
        x: friendX,
        y: 10,
        direction: 0,
        size: 100,
        visible,
        scripts: [],
      },
    ],
    stage: { actorOrder: [hero, friend] },
  };
}

describe("deterministic studio sensing", () => {
  it("reads current coordinates and a nearby visible actor", () => {
    const result = runMultiActorProgram(sensingProgram(), scene(40));
    expect(result.actors[0]?.world.variables).toMatchObject({ x: { value: 20 }, y: { value: 10 } });
    expect(result.actors[0]?.world.sprite.bubble?.text).toBe("juntos");
    expect(result.trace.find((entry) => entry.statementType === "if")?.conditionResult).toBe(true);
    expect(result.trace.map((entry) => entry.statementType)).toEqual([
      "goTo",
      "setVariable",
      "setVariable",
      "say",
      "if",
    ]);
  });

  it("does not report a distant or hidden actor, and a standalone run has no other actors", () => {
    for (const input of [scene(45), scene(40, false)]) {
      const result = runMultiActorProgram(sensingProgram(), input);
      expect(result.actors[0]?.world.sprite.bubble?.text).toBe("lejos");
      expect(result.trace.find((entry) => entry.statementType === "if")?.conditionResult).toBe(
        false,
      );
    }
    expect(runProgram(sensingProgram(), createWorldState()).world.sprite.bubble?.text).toBe(
      "lejos",
    );
  });

  it("rejects malformed actor references and preserves sensor expressions through validation", () => {
    expect(validateProgram(sensingProgram()).scripts[0]?.statements[1]).toEqual({
      type: "setVariable",
      variableId: "x",
      value: { type: "xPosition" },
    });
    const malformed = structuredClone(sensingProgram()) as unknown as {
      scripts: { statements: unknown[] }[];
    };
    malformed.scripts[0]!.statements[3] = {
      type: "if",
      condition: { type: "touchingActor", actorId: "" },
      then: [],
    };
    expect(() => validateProgram(malformed)).toThrow();
  });
});
