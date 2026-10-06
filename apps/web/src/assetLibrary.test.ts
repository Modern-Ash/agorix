import { describe, expect, it } from "vitest";
import { ACTOR_VISUALS, BACKDROPS, findActorVisual, findBackdrop } from "./assetLibrary";

describe("asset library", () => {
  it("offers at least three actor visuals and three backdrops", () => {
    expect(ACTOR_VISUALS.length).toBeGreaterThanOrEqual(3);
    expect(BACKDROPS.length).toBeGreaterThanOrEqual(3);
  });

  it("has unique persisted-safe ids, both locales and glyphs for actors", () => {
    const all = [...ACTOR_VISUALS, ...BACKDROPS];
    expect(new Set(all.map((asset) => asset.id)).size).toBe(all.length);
    for (const asset of all) {
      expect(asset.id).toMatch(/^[a-z][a-z0-9-]{0,31}$/);
      expect(asset.name.en).not.toBe("");
      expect(asset.name.es).not.toBe("");
    }
    for (const asset of ACTOR_VISUALS) expect(asset.glyph).toBeTruthy();
  });

  it("resolves unknown ids to nothing so the world default is used", () => {
    expect(findActorVisual("missing")).toBeUndefined();
    expect(findBackdrop(undefined)).toBeUndefined();
  });
});
