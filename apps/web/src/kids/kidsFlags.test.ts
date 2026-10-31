import { describe, expect, it } from "vitest";
import {
  KIDS_FLAGS_KEY,
  KIDS_V2_FEATURES,
  kidsV2Enabled,
  kidsV2Features,
  setKidsV2Feature,
} from "./kidsFlags.js";

const storageWith = (value: string | null) => ({ getItem: () => value });

describe("Kids v2 flags (issue #439)", () => {
  it("enables creative tools in a new browser and keeps account linking gated", () => {
    expect([...kidsV2Features()]).toEqual(
      KIDS_V2_FEATURES.filter((name) => name !== "adultLink" && name !== "groupMode"),
    );
    expect(kidsV2Enabled("customImages", { storage: storageWith(null), search: "" })).toBe(true);
    expect(kidsV2Enabled("duplicate", { storage: storageWith(null), search: "" })).toBe(true);
    expect(kidsV2Enabled("oriFloat", { storage: storageWith(null), search: "" })).toBe(true);
    expect(kidsV2Enabled("adultLink", { storage: storageWith(null), search: "" })).toBe(false);
    expect(kidsV2Enabled("groupMode", { storage: storageWith(null), search: "" })).toBe(false);
  });

  it("can enable the existing adult flow for a reviewed deployment build", () => {
    expect(kidsV2Enabled("adultLink", { storage: storageWith(null), adultLinkDefault: true })).toBe(
      true,
    );
    expect(kidsV2Enabled("adultLink", { storage: storageWith("[]"), adultLinkDefault: true })).toBe(
      false,
    );
    expect(kidsV2Enabled("groupMode", { storage: storageWith(null), adultLinkDefault: true })).toBe(
      false,
    );
  });

  it("accepts an explicit empty list as a rollback", () => {
    expect(kidsV2Features({ storage: storageWith("[]") }).size).toBe(0);
  });

  it("reads a validated list from storage", () => {
    const storage = storageWith('["duplicate","zoom","nope",3]');
    expect([...kidsV2Features({ storage })].sort()).toEqual(["duplicate", "zoom"]);
  });

  it("fails closed for corrupt or blocked storage", () => {
    expect(kidsV2Features({ storage: storageWith("{not json") }).size).toBe(0);
    expect(kidsV2Features({ storage: storageWith('{"a":1}') }).size).toBe(0);
    const blocked = {
      getItem: (key: string) => {
        expect(key).toBe(KIDS_FLAGS_KEY);
        throw new DOMException("blocked", "SecurityError");
      },
    };
    expect(kidsV2Features({ storage: blocked }).size).toBe(0);
  });

  it("accepts the query parameter outside production and drops unknown names", () => {
    expect([...kidsV2Features({ search: "?kidsv2=adultLink,groupMode,bogus" })].sort()).toEqual(
      [...KIDS_V2_FEATURES].sort(),
    );
  });

  it("ignores the query parameter in production but keeps storage", () => {
    const sources = {
      search: "?kidsv2=tutorial",
      production: true,
      storage: storageWith('["zoom"]'),
    };
    expect([...kidsV2Features(sources)]).toEqual(["zoom"]);
  });

  it("lets the adult persistently toggle custom images without dropping other flags", () => {
    let value: string | null = null;
    const storage = {
      getItem: () => value,
      setItem: (_key: string, next: string) => {
        value = next;
      },
    };
    expect(setKidsV2Feature("customImages", false, storage)).toBe(true);
    expect(kidsV2Features({ storage }).has("customImages")).toBe(false);
    value = '["zoom"]';
    expect(setKidsV2Feature("customImages", true, storage)).toBe(true);
    expect([...kidsV2Features({ storage })].sort()).toEqual(["customImages", "zoom"]);
  });

  it("keeps the flag unchanged if storage rejects the adult's choice", () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException("blocked", "QuotaExceededError");
      },
    };
    expect(setKidsV2Feature("customImages", false, storage)).toBe(false);
    expect(kidsV2Enabled("customImages", { storage })).toBe(true);
  });

  it("keeps a saved list as it was: features added to the defaults later stay off there (#1123)", () => {
    // What a browser stored when only the first thirteen existed and an adult toggled one flag.
    const legacy = JSON.stringify(
      KIDS_V2_FEATURES.filter(
        (name) =>
          name !== "adultLink" &&
          name !== "groupMode" &&
          name !== "extensionPen" &&
          name !== "extensionMusic",
      ),
    );
    const sources = { storage: storageWith(legacy), search: "", production: true };
    expect(kidsV2Enabled("oriFloat", sources)).toBe(true);
    expect(kidsV2Enabled("extensionPen", sources)).toBe(false);
    expect(kidsV2Enabled("extensionMusic", sources)).toBe(false);
    // A fresh browser has both, so two browsers can show different palettes for the same build.
    expect(kidsV2Enabled("extensionPen", { storage: storageWith(null), search: "" })).toBe(true);
  });
});
