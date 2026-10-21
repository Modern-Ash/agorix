import { describe, expect, it } from "vitest";
import { BUILD_INFO, formatBuildInfo } from "./buildInfo.js";

describe("build info (issue #342)", () => {
  it("formats version and short commit for the app menu", () => {
    expect(formatBuildInfo({ version: "0.1.0", sha: "abc1234def56" })).toBe("v0.1.0 · abc1234");
  });

  it("omits the commit when the build is not tied to one", () => {
    expect(formatBuildInfo({ version: "0.1.0", sha: "dev" })).toBe("v0.1.0");
    expect(formatBuildInfo({ version: "0.1.0", sha: "unknown" })).toBe("v0.1.0");
  });

  it("shows plain dev for an unversioned development build", () => {
    expect(formatBuildInfo({ version: "dev", sha: "dev" })).toBe("dev");
  });

  it("falls back to a development build outside Vite", () => {
    expect(BUILD_INFO).toEqual({ version: "dev", sha: "dev" });
  });
});
