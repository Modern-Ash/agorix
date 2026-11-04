import { describe, expect, it } from "vitest";
import type { Statement } from "@agorix/program-model";
import { BLOCK_NEEDS, needHint, paletteFacts, unmetNeed } from "./kidsPaletteRules.js";
import { STUDIO_BLOCK_CATEGORY } from "./kidsPaletteCatalog.js";

const script = (...statements: Statement[]) => ({ statements });

describe("palette dependency rules", () => {
  it("every rule names a block of the catalog", () => {
    for (const kind of Object.keys(BLOCK_NEEDS)) expect(kind in STUDIO_BLOCK_CATEGORY).toBe(true);
  });

  it("stop sounds waits for a sound anywhere in the project", () => {
    expect(unmetNeed("stopSounds", paletteFacts([script()], 1))).toBe("sound");
    expect(
      unmetNeed(
        "stopSounds",
        paletteFacts([script({ type: "playSound", soundId: "kids-tone" })], 1),
      ),
    ).toBeUndefined();
    // Another character's script counts, and so does a sound nested in a loop.
    expect(
      unmetNeed(
        "stopSounds",
        paletteFacts(
          [
            script(),
            script({ type: "repeat", count: 2, body: [{ type: "playSound", soundId: "x" }] }),
          ],
          2,
        ),
      ),
    ).toBeUndefined();
  });

  it("layers need two characters", () => {
    expect(unmetNeed("goToLayer", paletteFacts([script()], 1))).toBe("characters");
    expect(unmetNeed("goToLayer", paletteFacts([script()], 2))).toBeUndefined();
  });

  it("clear effects, list edits, variable display and pen up wait for what they act on", () => {
    const empty = paletteFacts([script()], 1);
    expect(unmetNeed("clearEffects", empty)).toBe("effect");
    expect(unmetNeed("listRemoveAt", empty)).toBe("list");
    expect(unmetNeed("showVariable", empty)).toBe("variable");
    expect(unmetNeed("penUp", empty)).toBe("pen");
    expect(unmetNeed("clearPen", empty)).toBe("pen");
    expect(
      unmetNeed("penUp", paletteFacts([script({ type: "penDown" } as Statement)], 1)),
    ).toBeUndefined();
  });

  it("blocks with no rule, and volume, are always available", () => {
    const empty = paletteFacts([script()], 1);
    for (const kind of ["move", "turn", "say", "setVolume", "changeVolume", "playSound"] as const)
      expect(unmetNeed(kind, empty)).toBeUndefined();
  });

  it("every need has a hint in both languages", () => {
    for (const need of new Set(Object.values(BLOCK_NEEDS))) {
      expect(needHint(need, "es").length).toBeGreaterThan(10);
      expect(needHint(need, "en").length).toBeGreaterThan(10);
    }
  });
});
