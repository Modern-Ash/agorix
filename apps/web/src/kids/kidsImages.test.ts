import { describe, expect, it } from "vitest";
import {
  clearKidsImages,
  imageSlot,
  imageStorageBytes,
  loadKidsImages,
  updateKidsImage,
} from "./kidsImages.js";

const url = `data:image/webp;base64,${"A".repeat(80)}`;

function storage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: (_key: string) => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
}

describe("adult game images (issue #458)", () => {
  it("allows only Ori, built-in explorers and built-in worlds", () => {
    expect(imageSlot("ori")).toBe(true);
    expect(imageSlot("explorer:🐸")).toBe(true);
    expect(imageSlot("world:space")).toBe(true);
    expect(imageSlot("explorer:unknown")).toBe(false);
    expect(imageSlot("world:custom-id")).toBe(false);
    expect(imageSlot("__proto__")).toBe(false);
  });

  it("saves a slot, removes it and reports its storage size", () => {
    const store = storage();
    expect(updateKidsImage("ori", url, store)).toMatchObject({ ok: true });
    expect(loadKidsImages(store)).toEqual({ ori: url });
    expect(imageStorageBytes(loadKidsImages(store))).toBeGreaterThan(0);
    expect(updateKidsImage("ori", null, store)).toMatchObject({ ok: true });
    expect(loadKidsImages(store)).toEqual({});
    expect(updateKidsImage("world:space", url, store)).toMatchObject({ ok: true });
    expect(clearKidsImages(store)).toMatchObject({ ok: true });
    expect(loadKidsImages(store)).toEqual({});
  });

  it("ignores corrupt entries and rejects malformed URLs and invalid slots", () => {
    const store = storage(
      JSON.stringify({ ori: url, "world:space": "https://example.test/photo" }),
    );
    expect(loadKidsImages(store)).toEqual({ ori: url });
    expect(updateKidsImage("world:space", "data:image/svg+xml;base64,AA==", store)).toEqual({
      ok: false,
      reason: "invalidImage",
    });
    expect(updateKidsImage("world:custom", url, store)).toEqual({
      ok: false,
      reason: "invalidSlot",
    });
    expect(loadKidsImages(storage("not json"))).toEqual({});
  });

  it("enforces the 1 MB total and survives blocked storage", () => {
    const store = storage();
    const large = `data:image/webp;base64,${"A".repeat(75_000)}`;
    let failed = false;
    for (const slot of [
      "ori",
      "explorer:🦊",
      "explorer:🐼",
      "explorer:🐸",
      "explorer:🦁",
      "explorer:🐨",
      "explorer:🦄",
      "world:space",
    ]) {
      const result = updateKidsImage(slot, large, store);
      if (!result.ok) {
        expect(result.reason).toBe("tooLarge");
        failed = true;
        break;
      }
    }
    expect(failed).toBe(true);
    expect(imageStorageBytes(loadKidsImages(store))).toBeLessThanOrEqual(1024 * 1024);

    const blocked = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("quota", "QuotaExceededError");
      },
    };
    expect(updateKidsImage("ori", url, blocked)).toEqual({
      ok: false,
      reason: "storageUnavailable",
    });
    expect(clearKidsImages(blocked)).toEqual({ ok: false, reason: "storageUnavailable" });
  });
});
