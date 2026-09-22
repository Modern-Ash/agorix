import { describe, expect, it } from "vitest";
import { describeTutorApi } from "./index.js";

describe("tutor-api placeholder", () => {
  it("describes itself without calling a provider", () => {
    expect(describeTutorApi()).toContain("no provider call yet");
  });
});
