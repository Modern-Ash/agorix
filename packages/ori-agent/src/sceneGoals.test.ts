import { describe, expect, it } from "vitest";
import {
  ORI_SCENE_GOAL_VERSION,
  parseOriSceneGoalChoices,
  runOriSceneGoalAgent,
  type OriSceneGoalChoice,
} from "./sceneGoals.js";

const NOVA = "actor:studio-1-nova";
const MIKA = "actor:studio-2-mika";
const choices: readonly OriSceneGoalChoice[] = [
  { kind: "reachEdge", actorId: NOVA },
  { kind: "touchActor", actorId: NOVA, targetId: MIKA },
];
const model = (output: unknown) => ({ generate: async () => output }) as never;

describe("Ori scene goal agent (issue #1135)", () => {
  it("accepts a valid model choice and keeps wording out of the model's hands", async () => {
    const out = await runOriSceneGoalAgent(
      "es",
      choices,
      model(JSON.stringify({ version: ORI_SCENE_GOAL_VERSION, choice: 1 })),
    );
    expect(out).toEqual({ source: "model", choice: 1 });
  });

  it("falls back on bad versions, extra keys, free text, out-of-range or no model", async () => {
    const bad = [
      { version: "x", choice: 0 },
      { version: ORI_SCENE_GOAL_VERSION, choice: 2 },
      { version: ORI_SCENE_GOAL_VERSION, choice: -1 },
      { version: ORI_SCENE_GOAL_VERSION, choice: 0, message: "hola" },
      { version: ORI_SCENE_GOAL_VERSION, choice: "1" },
      "not json",
    ];
    for (const output of bad)
      expect(await runOriSceneGoalAgent("en", choices, model(output))).toEqual({
        source: "fallback",
        choice: 0,
      });
    expect(await runOriSceneGoalAgent("en", choices)).toEqual({ source: "fallback", choice: 0 });
  });

  it("falls back when the model throws", async () => {
    const throwing = { generate: async () => Promise.reject(new Error("down")) } as never;
    expect((await runOriSceneGoalAgent("es", choices, throwing)).source).toBe("fallback");
  });

  it("parses only the closed choice shape", () => {
    expect(parseOriSceneGoalChoices(choices)).toEqual(choices);
    for (const value of [
      [],
      "x",
      [{ kind: "reachEdge", actorId: "Nova" }],
      [{ kind: "reachEdge", actorId: NOVA, note: "hola" }],
      [{ kind: "touchActor", actorId: NOVA, targetId: NOVA }],
      [{ kind: "touchActor", actorId: NOVA }],
      [{ kind: "fly", actorId: NOVA }],
      Array.from({ length: 41 }, () => ({ kind: "reachEdge", actorId: NOVA })),
    ])
      expect(parseOriSceneGoalChoices(value)).toBeNull();
  });
});
