import { describe, expect, it } from "vitest";
import {
  FIRST_MISSION,
  SUPPORTED_LOCALES,
  WORLDS,
  getLocalizedFirstMission,
  getWorld,
  worldCopy,
  worldsForMission,
} from "./index.js";

describe("worlds", () => {
  it("offers Space, Ocean, Robots and City for the first mission", () => {
    expect(worldsForMission(FIRST_MISSION.id, FIRST_MISSION.version).map((w) => w.id)).toEqual([
      "space.trailhead",
      "ocean.reef",
      "robots.workshop",
      "city.crossing",
    ]);
  });

  it("binds to the actual first mission", () => {
    for (const world of WORLDS) {
      expect(world.missionBindings).toEqual([
        { missionId: FIRST_MISSION.id, version: FIRST_MISSION.version },
      ]);
    }
  });

  it("has complete display copy for every supported locale", () => {
    for (const world of WORLDS) {
      expect(world.supportedLocales).toEqual([...SUPPORTED_LOCALES]);
      for (const locale of SUPPORTED_LOCALES) {
        for (const [key, value] of Object.entries(worldCopy(world, locale))) {
          expect(value.trim().length, `${world.id}.${locale}.${key}`).toBeGreaterThan(0);
        }
      }
    }
  });

  it("uses locale-independent ids and never carries mission or program semantics", () => {
    for (const world of WORLDS) {
      expect(world.id).toMatch(/^[a-z]+\.[a-z]+$/);
      const keys = Object.keys(world);
      for (const forbidden of ["starterProject", "starterStage", "completion", "program"]) {
        expect(keys).not.toContain(forbidden);
      }
    }
  });

  it("does not change mission semantics when the world changes", () => {
    const before = JSON.stringify(getLocalizedFirstMission("en").completion);
    getWorld("ocean.reef");
    expect(JSON.stringify(getLocalizedFirstMission("en").completion)).toBe(before);
  });

  it("falls back to the default world for unknown ids", () => {
    expect(getWorld("nope").id).toBe("space.trailhead");
  });
});
