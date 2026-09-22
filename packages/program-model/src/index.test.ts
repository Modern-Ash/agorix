import { describe, expect, it } from "vitest";
import { PACKAGE_NAME, SCHEMA_VERSION } from "./index.js";

describe("program-model package identity", () => {
  it("exports a package identity", () => {
    expect(PACKAGE_NAME).toBe("@agorix/program-model");
  });

  it("exports the schema version as the documented literal", () => {
    expect(SCHEMA_VERSION).toBe("agorix/program/v1");
  });
});
