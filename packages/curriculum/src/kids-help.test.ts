import { describe, expect, it } from "vitest";
import { KIDS_MISSION_IDS, getKidsMission, getKidsHint, kidsHintUnlocked } from "./index.js";

describe("Kids hint policy (issue #383)", () => {
  const mission = getKidsMission(KIDS_MISSION_IDS[0], "es");

  it("starts at level 1 and unlocks each next level after the earlier hint was used", () => {
    expect(getKidsHint(mission, 1, [])?.level).toBe(1);
    expect(kidsHintUnlocked(2, [1])).toBe(true);
    expect(kidsHintUnlocked(3, [1, 2])).toBe(true);
    expect(kidsHintUnlocked(4, [1, 2, 3])).toBe(true);
    expect(kidsHintUnlocked(5, [1, 2, 3, 4])).toBe(true);
  });

  it("keeps Ver idea locked until levels 1 through 4 were used", () => {
    expect(kidsHintUnlocked(5, [])).toBe(false);
    expect(kidsHintUnlocked(5, [1, 2, 4])).toBe(false);
    expect(getKidsHint(mission, 5, [1, 2, 4])).toBeUndefined();
    expect(getKidsHint(mission, 5, [1, 2, 3, 4])?.level).toBe(5);
  });

  it("rejects invalid levels and ignores duplicate or out-of-range history", () => {
    expect(kidsHintUnlocked(0, [])).toBe(false);
    expect(kidsHintUnlocked(6, [1, 2, 3, 4, 5])).toBe(false);
    expect(kidsHintUnlocked(3, [1, 1, 2, 99])).toBe(true);
  });
});
