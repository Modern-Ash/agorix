import { describe, expect, it } from "vitest";
import {
  SCHEMA_VERSION,
  validateProjectCreativeState,
  type ProjectCreativeState,
  type ProjectProgram,
} from "@agorix/program-model";
import { runMultiActorProgram } from "./multiActor.js";

const ifOnGreen: ProjectProgram = {
  schema: SCHEMA_VERSION,
  scripts: [
    {
      id: "main",
      trigger: { type: "greenFlag" },
      statements: [
        {
          type: "if",
          condition: { type: "touchingColor", color: "green" },
          then: [{ type: "say", text: "verde" }],
        },
      ],
    },
  ],
};

const scene = (y: number, backdropId = "backdrop:forest"): ProjectCreativeState => ({
  actors: [{ id: "actor:main", name: "Nova", x: 100, y, direction: 0, size: 100, visible: true }],
  assets: [
    { id: "backdrop:forest", kind: "backdrop", name: "Forest", source: "builtin:forest" },
    { id: "backdrop:custom-1", kind: "backdrop", name: "Mine", source: "builtin:custom" },
  ],
  stage: { backdropId },
  colorZones: {
    "backdrop:forest": [
      { color: "blue", x: 0, y: -100, width: 320, height: 145 },
      { color: "green", x: 0, y: 45, width: 320, height: 75 },
    ],
  },
});

const said = (creative: ProjectCreativeState) =>
  runMultiActorProgram(ifOnGreen, creative).trace.some((entry) => entry.statementType === "say");

describe("touching a colour, decided on the scene model", () => {
  it("is true over a zone of that colour and false over another one", () => {
    expect(said(scene(80))).toBe(true);
    expect(said(scene(-20))).toBe(false);
  });

  it("is false on a backdrop without colour zones, so a project still runs there", () => {
    expect(said(scene(80, "backdrop:custom-1"))).toBe(false);
    const full = scene(80);
    expect(said({ actors: full.actors!, stage: full.stage!, assets: full.assets! })).toBe(false);
  });

  it("is false for a character that is hidden", () => {
    const creative = scene(80);
    expect(said({ ...creative, actors: [{ ...creative.actors![0]!, visible: false }] })).toBe(
      false,
    );
  });

  it("is checked: only the closed palette, bounded zones, nothing else in them", () => {
    const check = (colorZones: unknown) => validateProjectCreativeState({ colorZones }, ifOnGreen);
    expect(() =>
      check({ "backdrop:forest": [{ color: "pink", x: 0, y: 0, width: 1, height: 1 }] }),
    ).toThrow();
    expect(() =>
      check({ "backdrop:forest": [{ color: "red", x: 0, y: 0, width: -1, height: 1 }] }),
    ).toThrow();
    expect(() =>
      check({ "backdrop:forest": [{ color: "red", x: 0, y: 0, width: 1, height: 1, note: "x" }] }),
    ).toThrow();
    expect(() =>
      check({
        "backdrop:forest": Array.from({ length: 9 }, () => ({
          color: "red",
          x: 0,
          y: 0,
          width: 1,
          height: 1,
        })),
      }),
    ).toThrow();
    expect(
      check({ "backdrop:forest": [{ color: "red", x: 0, y: 0, width: 1, height: 1 }] }).colorZones,
    ).toBeDefined();
  });
});
