import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "@agorix/program-model";

describe("web app package import (R3)", () => {
  it("can import a shared domain package", () => {
    expect(PACKAGE_NAME).toBe("@agorix/program-model");
  });
});
