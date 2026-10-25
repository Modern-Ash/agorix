import { describe, expect, it } from "vitest";
import { readGroupConfig } from "./groupConfig.js";

// Issue #566: startup configuration for the optional closed groups.
const SECRET = "g".repeat(40);

describe("readGroupConfig", () => {
  it("is off when unset or empty, with or without the adult link", () => {
    expect(readGroupConfig({}, true)).toEqual({});
    expect(readGroupConfig({ AGORIX_GROUP_SECRET: "" }, false)).toEqual({});
  });

  it("enables with a long secret and the adult link", () => {
    expect(readGroupConfig({ AGORIX_GROUP_SECRET: SECRET }, true)).toEqual({ secret: SECRET });
  });

  it("fails fast on a short secret or without the adult link", () => {
    expect(() => readGroupConfig({ AGORIX_GROUP_SECRET: "short" }, true)).toThrow("32 characters");
    expect(() => readGroupConfig({ AGORIX_GROUP_SECRET: SECRET }, false)).toThrow(
      "AGORIX_LINK_SECRET",
    );
  });
});
