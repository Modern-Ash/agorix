import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "./index.js";

describe("stage placeholder", () => {
  it("exports a package identity", () => {
    expect(PACKAGE_NAME).toBe("@agorix/stage");
  });
});
