import { describe, expect, it } from "vitest";
import { KIDS_FLAGS_KEY, kidsV2Enabled, kidsV2Features } from "./kidsFlags.js";

const storageWith = (value: string | null) => ({ getItem: () => value });

describe("Kids v2 flags (issue #439)", () => {
  it("is off by default", () => {
    expect(kidsV2Features().size).toBe(0);
    expect(kidsV2Enabled("duplicate", { storage: storageWith(null), search: "" })).toBe(false);
  });

  it("reads a validated list from storage", () => {
    const storage = storageWith('["duplicate","zoom","nope",3]');
    expect([...kidsV2Features({ storage })].sort()).toEqual(["duplicate", "zoom"]);
  });

  it("falls back to off for corrupt or blocked storage", () => {
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
    expect([...kidsV2Features({ search: "?kidsv2=tutorial,bogus,ageBands" })].sort()).toEqual([
      "ageBands",
      "tutorial",
    ]);
  });

  it("ignores the query parameter in production but keeps storage", () => {
    const sources = {
      search: "?kidsv2=tutorial",
      production: true,
      storage: storageWith('["zoom"]'),
    };
    expect([...kidsV2Features(sources)]).toEqual(["zoom"]);
  });
});
