import { describe, expect, it } from "vitest";
import { PALETTE_VIEW_KEY, readPaletteView, writePaletteView } from "./kidsPaletteView.js";

function storage(initial?: string) {
  const data = new Map<string, string>(initial === undefined ? [] : [[PALETTE_VIEW_KEY, initial]]);
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

describe("palette view preference", () => {
  it("shows one category at a time unless the device chose to list everything", () => {
    expect(readPaletteView(storage())).toBe("focused");
    expect(readPaletteView(storage("all"))).toBe("all");
    expect(readPaletteView(storage("anything else"))).toBe("focused");
    expect(readPaletteView(undefined)).toBe("focused");
  });

  it("stores the choice and survives unavailable storage", () => {
    const store = storage();
    expect(writePaletteView("all", store)).toBe(true);
    expect(readPaletteView(store)).toBe("all");
    expect(
      writePaletteView("focused", {
        setItem: () => {
          throw new Error("blocked");
        },
      }),
    ).toBe(false);
  });
});
