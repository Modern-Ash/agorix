import { describe, expect, it } from "vitest";
import {
  KIDS_CREATE_SELECTION_KEY,
  loadCreateSelection,
  saveCreateSelection,
  studioStart,
} from "./kidsCreateSelection.js";

// Issue #594: one remembered selection, only fixed ids, and Escena libre starts from it.
function memory(initial?: string) {
  let value = initial ?? null;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
}

describe("Crear selection", () => {
  it("remembers a gallery character and backdrop", () => {
    const store = memory();
    saveCreateSelection(
      { avatar: { kind: "gallery", id: "luma" }, world: { kind: "gallery", id: "forest" } },
      store,
    );
    expect(loadCreateSelection(store)).toEqual({
      avatar: { kind: "gallery", id: "luma" },
      world: { kind: "gallery", id: "forest" },
    });
  });

  it("ignores anything that is not a known id", () => {
    for (const raw of [
      "not json",
      "null",
      JSON.stringify({
        avatar: { kind: "gallery", id: "hacker" },
        world: { kind: "builtin", value: "space" },
      }),
      JSON.stringify({
        avatar: { kind: "emoji", value: "💀" },
        world: { kind: "builtin", value: "space" },
      }),
      JSON.stringify({
        avatar: { kind: "custom", id: "../x" },
        world: { kind: "builtin", value: "space" },
      }),
      JSON.stringify({ avatar: { kind: "emoji", value: "🦊" } }),
    ])
      expect(loadCreateSelection(memory(raw))).toBeNull();
    expect(loadCreateSelection(undefined)).toBeNull();
    expect(KIDS_CREATE_SELECTION_KEY).toBe("agorix.kids.create.v1");
  });

  it("starts a scene with the chosen gallery character and says when it could not", () => {
    expect(
      studioStart({
        avatar: { kind: "gallery", id: "luma" },
        world: { kind: "gallery", id: "forest" },
      }),
    ).toMatchObject({ characterId: "luma", characterIsChosen: true, backdropIsChosen: true });
    const fallback = studioStart({
      avatar: { kind: "emoji", value: "🦊" },
      world: { kind: "builtin", value: "space" },
    });
    expect(fallback).toMatchObject({ characterId: "nova", backdropId: "forest" });
    expect(fallback.characterIsChosen).toBe(false);
    expect(fallback.backdropIsChosen).toBe(false);
  });
});
