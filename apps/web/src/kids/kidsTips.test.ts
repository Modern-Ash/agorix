import { describe, expect, it } from "vitest";
import { STUDIO_BLOCK_CATEGORY } from "./kidsPaletteCatalog.js";
import { BLOCK_TIPS } from "./kidsTips.js";

describe("tooltip texts (#1246)", () => {
  it("every block of the catalog says what it does, in both languages", () => {
    for (const kind of Object.keys(STUDIO_BLOCK_CATEGORY)) {
      const tip = BLOCK_TIPS[kind];
      expect(tip, kind).toBeDefined();
      expect(tip!.es.length, `${kind} es`).toBeGreaterThan(8);
      expect(tip!.en.length, `${kind} en`).toBeGreaterThan(8);
    }
  });

  it("has no tip for a block that does not exist", () => {
    for (const kind of Object.keys(BLOCK_TIPS)) expect(kind in STUDIO_BLOCK_CATEGORY).toBe(true);
  });

  it("stays short enough to read at a glance", () => {
    for (const [kind, tip] of Object.entries(BLOCK_TIPS)) {
      expect(tip.es.length, kind).toBeLessThanOrEqual(70);
      expect(tip.en.length, kind).toBeLessThanOrEqual(70);
    }
  });
});
