import { describe, expect, it } from "vitest";
import { assertOriMig04StartupSafe } from "./oriMig04PgStartupGuard.js";

describe("MIG-04 production startup fail-closed guard", () => {
  it("rejects environment-only pilot activation", () => {
    expect(() => assertOriMig04StartupSafe({ AGORIX_ORI_MIG04_PILOT: "1" })).toThrow(
      "environment activation is forbidden",
    );
  });
  it("rejects ambiguous and alternate activation values", () => {
    for (const value of ["true", "yes", "pilot", " 1 ", "", "false"]) {
      expect(() => assertOriMig04StartupSafe({ AGORIX_ORI_MIG04_PILOT: value })).toThrow(
        "environment activation is forbidden",
      );
    }
  });
  it("does not change default startup behavior", () => {
    expect(() => assertOriMig04StartupSafe({})).not.toThrow();
  });
  it("does not enable the pilot with disabled configuration", () => {
    expect(() => assertOriMig04StartupSafe({ AGORIX_ORI_MIG04_PILOT: "0" })).not.toThrow();
  });
});
