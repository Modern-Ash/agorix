import { describe, expect, it } from "vitest";
import {
  addKidsCustom,
  deleteKidsCustom,
  loadKidsCustom,
  resolveKidsCustom,
} from "./kidsCustom.js";

const image = `data:image/webp;base64,${"A".repeat(80)}`;

function storage(initial: string | null = null) {
  let value = initial;
  return {
    getItem: () => value,
    setItem: (_key: string, next: string) => {
      value = next;
    },
  };
}

describe("custom Kids artwork (issues #459 and #460)", () => {
  it("adds a local explorer and backdrop with stable custom ids", () => {
    const store = storage();
    expect(addKidsCustom("explorer", image, store)).toMatchObject({
      ok: true,
      item: { id: "custom-1" },
    });
    expect(addKidsCustom("backdrop", image, store)).toMatchObject({
      ok: true,
      item: { id: "custom-2" },
    });
    expect(loadKidsCustom(store)).toHaveLength(2);
    expect(resolveKidsCustom("custom-1", "explorer", store)).toBe(image);
    expect(resolveKidsCustom("custom-1", "backdrop", store)).toBeUndefined();
  });

  it("caps the collection at twelve and deletion makes an old ref fall back", () => {
    const store = storage();
    for (let i = 0; i < 12; i++) expect(addKidsCustom("explorer", image, store).ok).toBe(true);
    expect(addKidsCustom("backdrop", image, store)).toEqual({ ok: false, reason: "limit" });
    expect(deleteKidsCustom("custom-1", store)).toBe(true);
    expect(resolveKidsCustom("custom-1", "explorer", store)).toBeUndefined();
    expect(addKidsCustom("backdrop", image, store)).toMatchObject({
      ok: true,
      item: { id: "custom-13" },
    });
  });

  it("rejects remote or malformed images and survives blocked storage", () => {
    const store = storage(
      JSON.stringify([{ id: "custom-1", kind: "explorer", dataUrl: "https://bad.test/a" }]),
    );
    expect(loadKidsCustom(store)).toEqual([]);
    expect(addKidsCustom("explorer", "https://bad.test/a", store)).toEqual({
      ok: false,
      reason: "invalidImage",
    });
    expect(
      addKidsCustom("explorer", image, {
        getItem: () => null,
        setItem: () => {
          throw Error("quota");
        },
      }),
    ).toEqual({ ok: false, reason: "storageUnavailable" });
  });
});
