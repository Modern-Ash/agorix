import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  validateProjectCreativeState,
  type ProjectProgram,
  type Statement,
} from "@agorix/program-model";
import { createWorldState, runProgram } from "./index.js";

const program = (statements: Statement[]): ProjectProgram => ({
  schema: SCHEMA_VERSION,
  scripts: [{ id: "main", trigger: { type: "greenFlag" }, statements }],
});

const secondCostume = (): Statement => ({
  type: "if",
  condition: {
    type: "greaterThan",
    left: { type: "costumeNumber" },
    right: { type: "numericLiteral", value: 1 },
  },
  then: [{ type: "move", steps: 10 }],
});

const order = ["costume:a", "costume:b"];

describe("costume and backdrop number", () => {
  it("counts costumes from 1 in the listed order, and moves when the costume changes", () => {
    const base = { costumeOrder: order };
    expect(
      runProgram(
        program([secondCostume()]),
        createWorldState({ sprite: { costumeId: "costume:a" } }),
        base,
      ).world.sprite.x,
    ).toBe(0);
    expect(
      runProgram(
        program([{ type: "switchCostume", costumeId: "costume:b" }, secondCostume()]),
        createWorldState({ sprite: { costumeId: "costume:a" } }),
        base,
      ).world.sprite.x,
    ).toBe(10);
  });

  it("is 0 when nothing is listed, and counts backdrops the same way", () => {
    const zero: Statement = {
      type: "if",
      condition: {
        type: "equals",
        left: { type: "costumeNumber" },
        right: { type: "numericLiteral", value: 0 },
      },
      then: [{ type: "move", steps: 5 }],
    };
    expect(runProgram(program([zero]), createWorldState()).world.sprite.x).toBe(5);
    const backdrop: Statement = {
      type: "if",
      condition: {
        type: "equals",
        left: { type: "backdropNumber" },
        right: { type: "numericLiteral", value: 2 },
      },
      then: [{ type: "move", steps: 7 }],
    };
    expect(
      runProgram(
        program([{ type: "switchBackdrop", backdropId: "backdrop:b" }, backdrop]),
        createWorldState({ backdropId: "backdrop:a" }),
        { backdropOrder: ["backdrop:a", "backdrop:b"] },
      ).world.sprite.x,
    ).toBe(7);
  });

  it("only accepts orders that name known costumes, backdrops and actors", () => {
    const empty = { schema: SCHEMA_VERSION, scripts: [] } as ProjectProgram;
    const assets = [
      { id: "costume:a", kind: "costume" as const, name: "A", source: "builtin:a" },
      { id: "backdrop:a", kind: "backdrop" as const, name: "B", source: "builtin:b" },
    ];
    const actors = [
      {
        id: "actor:one",
        name: "One",
        x: 0,
        y: 0,
        direction: 0,
        size: 100,
        visible: true,
        costumeId: "costume:a",
        scripts: [],
      },
    ];
    expect(() =>
      validateProjectCreativeState(
        {
          assets,
          actors,
          costumeOrders: { "actor:one": ["costume:a"] },
          backdropOrder: ["backdrop:a"],
        },
        empty,
      ),
    ).not.toThrow();
    expect(() =>
      validateProjectCreativeState(
        { assets, actors, costumeOrders: { "actor:one": ["costume:zzz"] } },
        empty,
      ),
    ).toThrow();
    expect(() =>
      validateProjectCreativeState({ assets, actors, costumeOrders: { "actor:two": [] } }, empty),
    ).toThrow();
    expect(() =>
      validateProjectCreativeState({ assets, backdropOrder: ["backdrop:a", "backdrop:a"] }, empty),
    ).toThrow();
  });
});
