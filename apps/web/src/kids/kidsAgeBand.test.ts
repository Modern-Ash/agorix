import { describe, expect, it } from "vitest";
import { AGE_BANDS, bandProfile, isAgeBand } from "./kidsAgeBand.js";

describe("age band profiles (issue #453)", () => {
  it("has a profile for every band with growing code languages and complexity", () => {
    expect(AGE_BANDS).toEqual(["6-8", "9-12", "13+"]);
    const profiles = AGE_BANDS.map(bandProfile);
    expect(profiles.map((profile) => profile.codeTabs.length)).toEqual([1, 3, 4]);
    expect(profiles.map((profile) => profile.mapComplexity)).toEqual([1, 2, 3]);
    for (const profile of profiles) expect(profile.codeTabs[0]).toBe("agorix");
  });

  it("recognises only the three bands", () => {
    expect(AGE_BANDS.every(isAgeBand)).toBe(true);
    for (const bad of ["teen", "6–8", "", null, undefined, 8]) expect(isAgeBand(bad)).toBe(false);
  });
});
