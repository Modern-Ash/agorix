import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "./index.js";

describe("code-generator", () => {
  it("exports a package identity", () => {
    expect(PACKAGE_NAME).toBe("@agorix/code-generator");
  });
});
