import { describe, expect, it } from "vitest";
import {
  KIDS_CREATE_SELECTION_KEY,
  loadCreateSelection,
  saveCreateSelection,
  studioStart,
} from "./kidsCreateSelection.js";

// Issue #594: two remembered choices (the explorer of a world, the character of a scene), fixed ids only.
function memory(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
}

const base = { avatar: { kind: "emoji", value: "🐼" }, world: { kind: "builtin", value: "space" } };

describe("Crear selection", () => {
  it("remembers the explorer and the scene character apart, so both stay chosen", () => {
    const store = memory();
    saveCreateSelection(
      {
        avatar: { kind: "emoji", value: "🐼" },
        world: { kind: "gallery", id: "forest" },
        scene: "comet",
      },
      store,
    );
    expect(loadCreateSelection(store)).toEqual({
      avatar: { kind: "emoji", value: "🐼" },
      world: { kind: "gallery", id: "forest" },
      scene: "comet",
    });
  });

  it("gives an older save the scene character it implied, or the default", () => {
    expect(
      loadCreateSelection(
        memory(JSON.stringify({ avatar: { kind: "gallery", id: "luma" }, world: base.world })),
      )?.scene,
    ).toBe("luma");
    expect(loadCreateSelection(memory(JSON.stringify(base)))?.scene).toBe("nova");
  });

  it("ignores anything that is not a known id", () => {
    for (const raw of [
      "not json",
      "null",
      JSON.stringify({ ...base, avatar: { kind: "gallery", id: "hacker" } }),
      JSON.stringify({ ...base, avatar: { kind: "emoji", value: "💀" } }),
      JSON.stringify({ ...base, avatar: { kind: "custom", id: "../x" } }),
      JSON.stringify({ avatar: base.avatar }),
    ])
      expect(loadCreateSelection(memory(raw))).toBeNull();
    // An unknown scene character falls back to the default instead of being trusted.
    expect(loadCreateSelection(memory(JSON.stringify({ ...base, scene: "hacker" })))?.scene).toBe(
      "nova",
    );
    expect(loadCreateSelection(undefined)).toBeNull();
    expect(KIDS_CREATE_SELECTION_KEY).toBe("agorix.kids.create.v1");
  });

  it("starts a scene with its own character and a gallery backdrop when there is one", () => {
    const withGallery = studioStart({
      avatar: { kind: "emoji", value: "🐼" },
      world: { kind: "gallery", id: "forest" },
      scene: "luma",
    });
    expect(withGallery).toMatchObject({ characterId: "luma", backdropId: "forest" });
    expect(withGallery.backdropIsChosen).toBe(true);
    const fallback = studioStart({
      avatar: { kind: "emoji", value: "🦊" },
      world: { kind: "builtin", value: "space" },
      scene: "nova",
    });
    expect(fallback).toMatchObject({ characterId: "nova", backdropId: "forest" });
    expect(fallback.backdropIsChosen).toBe(false);
  });
});
