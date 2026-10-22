import { describe, expect, it } from "vitest";
import { runMultiActorProgram } from "@agorix/runtime";
import {
  KIDS_ADVANCED_STAGES,
  evaluateKidsAdvancedMission,
  getKidsAdvancedMission,
} from "./kidsAdvanced.js";

describe("Kids advanced guided missions", () => {
  it("authors three short bilingual, runtime-checkable missions", () => {
    expect(KIDS_ADVANCED_STAGES).toEqual(["scene", "react", "score"]);
    for (const stage of KIDS_ADVANCED_STAGES) {
      const es = getKidsAdvancedMission(stage, "es");
      const en = getKidsAdvancedMission(stage, "en");
      expect(es.id).toBe(`kids.advanced.${stage}`);
      expect(es.title).not.toBe(en.title);
      expect(es.instruction.length).toBeGreaterThan(15);
      expect(es.reflection.length).toBeGreaterThan(10);
      expect(es.starterProgram.scripts[0]?.statements).toEqual([]);
    }
  });

  it("scene requires a costume change and sound from the same chosen actor", () => {
    const mission = getKidsAdvancedMission("scene", "es");
    const script = mission.starterProgram.scripts[0]!;
    const good = {
      ...mission.starterProgram,
      scripts: [
        {
          ...script,
          statements: [
            { type: "switchCostume" as const, costumeId: "asset:costume.spark" },
            { type: "playSound" as const, soundId: "asset:sound.beacon" },
          ],
        },
      ],
    };
    const run = runMultiActorProgram(good, mission.starterCreative);
    expect(evaluateKidsAdvancedMission("scene", run)).toBe(true);
    const soundOnly = runMultiActorProgram(
      {
        ...good,
        scripts: [
          { ...script, statements: [{ type: "playSound", soundId: "asset:sound.beacon" }] },
        ],
      },
      mission.starterCreative,
    );
    expect(evaluateKidsAdvancedMission("scene", soundOnly)).toBe(false);
  });

  it("react requires a real child event followed by an actor change", () => {
    const mission = getKidsAdvancedMission("react", "es");
    const script = mission.starterProgram.scripts[0]!;
    const program = {
      ...mission.starterProgram,
      scripts: [{ ...script, statements: [{ type: "turn" as const, degrees: 90 }] }],
    };
    const idle = runMultiActorProgram(program, mission.starterCreative);
    expect(evaluateKidsAdvancedMission("react", idle)).toBe(false);
    const clicked = runMultiActorProgram(program, mission.starterCreative, {
      events: [{ type: "actorClicked", actorId: "actor:ori" }],
    });
    expect(evaluateKidsAdvancedMission("react", clicked)).toBe(true);
  });

  it("score requires a visible watcher with a changed runtime value", () => {
    const mission = getKidsAdvancedMission("score", "es");
    const script = mission.starterProgram.scripts[0]!;
    const changed = {
      ...mission.starterProgram,
      scripts: [
        {
          ...script,
          statements: [
            {
              type: "changeVariable" as const,
              variableId: "score",
              delta: { type: "numericLiteral" as const, value: 1 },
            },
          ],
        },
      ],
    };
    expect(
      evaluateKidsAdvancedMission("score", runMultiActorProgram(changed, mission.starterCreative)),
    ).toBe(true);
    expect(
      evaluateKidsAdvancedMission(
        "score",
        runMultiActorProgram(mission.starterProgram, mission.starterCreative),
      ),
    ).toBe(false);
  });
});
