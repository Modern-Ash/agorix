import { describe, expect, it } from "vitest";
import {
  AGE_BANDS,
  bandProfile,
  codeTabsForBand,
  hintLevelsForBand,
  isAgeBand,
} from "./kidsAgeBand.js";

describe("age band profiles (issue #453)", () => {
  it("has a profile for every band with growing code languages and complexity", () => {
    expect(AGE_BANDS).toEqual(["6-8", "9-12", "13+"]);
    const profiles = AGE_BANDS.map(bandProfile);
    expect(profiles.map((profile) => profile.codeTabs.length)).toEqual([1, 3, 4]);
    for (const profile of profiles) expect(profile.codeTabs[0]).toBe("agorix");
  });

  it("scales text and targets down with age, never under the 44 px floor", () => {
    const profiles = AGE_BANDS.map(bandProfile);
    expect(profiles.map((profile) => profile.fontScale)).toEqual([1.125, 1, 0.95]);
    expect(profiles.map((profile) => profile.minTarget)).toEqual([56, 48, 44]);
    for (const profile of profiles) {
      expect(profile.minTarget).toBeGreaterThanOrEqual(44);
      expect(profile.fontScale).toBeGreaterThanOrEqual(0.9);
    }
  });

  it("older bands get their own help, idea size and voice defaults", () => {
    expect(AGE_BANDS.map((band) => hintLevelsForBand(band))).toEqual([5, 5, 4]);
    expect(hintLevelsForBand(undefined)).toBe(5);
    expect(AGE_BANDS.map((band) => bandProfile(band).oriMaxBlocks)).toEqual([6, 8, 8]);
    expect(AGE_BANDS.map((band) => bandProfile(band).readAloudDefault)).toEqual([
      true,
      false,
      false,
    ]);
  });

  it("keeps no property that nothing reads", () => {
    expect(Object.keys(bandProfile("6-8")).sort()).toEqual([
      "codeTabs",
      "fontScale",
      "minTarget",
      "oriMaxBlocks",
      "oriShape",
      "palette",
      "readAloudDefault",
      "solutionHint",
    ]);
  });

  it("recognises only the three bands", () => {
    expect(AGE_BANDS.every(isAgeBand)).toBe(true);
    for (const bad of ["teen", "6–8", "", null, undefined, 8]) expect(isAgeBand(bad)).toBe(false);
  });
});

describe("code tabs (issue #455)", () => {
  it("keeps the 6–8 default simple and reveals other installed languages in one step", () => {
    expect(codeTabsForBand("6-8", false)).toEqual(["agorix"]);
    expect(codeTabsForBand("6-8", true)).toEqual(["agorix", "python", "node", "java"]);
  });

  it("shows the profile languages for older bands", () => {
    expect(codeTabsForBand("9-12", false)).toEqual(["agorix", "python", "node"]);
    expect(codeTabsForBand("13+", false)).toEqual(["agorix", "python", "node", "java"]);
  });
});
