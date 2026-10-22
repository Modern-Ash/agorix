import { describe, expect, it } from "vitest";
import { kidsStringsEn, kidsStringsEs } from "./strings.js";

const placeholders = (value: unknown): string[] =>
  typeof value === "string" ? [...value.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort() : [];

describe("kids copy (issue #373)", () => {
  it("has the same keys in Spanish and English", () => {
    expect(Object.keys(kidsStringsEn).sort()).toEqual(Object.keys(kidsStringsEs).sort());
  });

  it("has the same nested keys for worlds and chips", () => {
    for (const table of ["worlds", "chips"] as const) {
      expect(Object.keys(kidsStringsEn[table] as object).sort()).toEqual(
        Object.keys(kidsStringsEs[table]).sort(),
      );
    }
  });

  it("uses the same placeholders in both languages", () => {
    for (const key of Object.keys(kidsStringsEs) as (keyof typeof kidsStringsEs)[]) {
      expect(placeholders(kidsStringsEn[key]), key).toEqual(placeholders(kidsStringsEs[key]));
    }
  });

  it("has no empty strings", () => {
    for (const table of [kidsStringsEs, kidsStringsEn] as const) {
      for (const value of Object.values(table)) {
        if (typeof value === "string") expect(value.trim()).not.toBe("");
      }
    }
  });
});
