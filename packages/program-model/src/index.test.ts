import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "./index.js";

describe("program-model placeholder", () => {
  it("exports a package identity", () => {
    expect(PACKAGE_NAME).toBe("@agorix/program-model");
  });
});
