import { describe, expect, it } from "vitest";
import { propertyHelp } from "./kidsPropertyHelp.js";

describe("Ori help for the property being edited", () => {
  it("explains each block field in both languages", () => {
    for (const locale of ["es", "en"] as const) {
      expect(propertyHelp({ kind: "block", fields: ["degrees"] }, locale)).toMatch(/90/);
      expect(
        propertyHelp({ kind: "block", fields: ["steps", "count"] }, locale).length,
      ).toBeGreaterThan(propertyHelp({ kind: "block", fields: ["steps"] }, locale).length);
      expect(propertyHelp({ kind: "backdrop" }, locale)).not.toBe(
        propertyHelp({ kind: "actor" }, locale),
      );
    }
  });
});
