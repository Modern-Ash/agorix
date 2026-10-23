import { describe, expect, it } from "vitest";
import { KIDS_SOUNDS, soundParameters, soundChoices, soundEvents } from "./kidsSoundLibrary.js";
import {
  addKidsBlock,
  createKidsEditor,
  playKidsProgram,
  setKidsBlockSound,
} from "./kidsEditorModel.js";
import { getKidsMission, KIDS_MISSION_IDS } from "@agorix/curriculum";

describe("Kids sound library (issue #461)", () => {
  it("has six named, bounded deterministic presets and a legacy fallback", () => {
    expect(KIDS_SOUNDS).toHaveLength(6);
    expect(new Set(KIDS_SOUNDS.map((item) => item.id)).size).toBe(6);
    for (const item of KIDS_SOUNDS) {
      expect(soundParameters(item.id)).toEqual(item.parameters);
      expect(item.parameters.duration).toBeGreaterThan(0);
      expect(item.parameters.duration).toBeLessThanOrEqual(0.5);
    }
    expect(soundParameters("kids-tone")).toEqual(soundParameters("unknown"));
    expect(soundChoices(false)).toHaveLength(6);
    expect(soundChoices(true)).toHaveLength(7);
  });

  it("counts each executed sound event with its chosen id, including repeats", () => {
    const mission = getKidsMission(KIDS_MISSION_IDS[0], "es");
    let history = addKidsBlock(createKidsEditor(mission), "repeat");
    history = addKidsBlock(history, "sound", 0);
    history = setKidsBlockSound(history, 0, "kids:win", 0);
    const events = soundEvents(playKidsProgram(history, mission).result.trace);
    expect(events).toEqual(["kids:win", "kids:win"]);
    const legacy = addKidsBlock(createKidsEditor(mission), "sound");
    expect(soundEvents(playKidsProgram(legacy, mission).result.trace)).toEqual(["kids-tone"]);
  });
});
