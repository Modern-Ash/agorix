import { describe, expect, it } from "vitest";
import { studioCategories, studioCategoryId } from "./kidsStudioCategories.js";

// Issue #1110: a jump bar over the free-scene palette, one entry per block category.
describe("free-scene block categories", () => {
  it("follow the redesign order with both packs on", () => {
    expect(studioCategories({ pen: true, music: true })).toEqual([
      "motion",
      "looks",
      "media",
      "logic",
      "pen",
      "music",
      "data",
      "myBlocks",
    ]);
  });

  it("leave out a pack a grown-up turned off", () => {
    expect(studioCategories({ pen: false, music: true })).not.toContain("pen");
    expect(studioCategories({ pen: true, music: false })).not.toContain("music");
    expect(studioCategories({ pen: false, music: false })).toHaveLength(6);
  });

  it("give every category its own heading id", () => {
    const ids = studioCategories({ pen: true, music: true }).map(studioCategoryId);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids[0]).toBe("kids-studio-cat-motion");
  });
});
