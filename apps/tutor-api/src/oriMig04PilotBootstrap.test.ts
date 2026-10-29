import { describe, expect, it } from "vitest";
import { openOriMig04Pilot } from "./oriMig04PilotBootstrap.js";

describe("MIG-04 optional Tutor bootstrap", () => {
  it("fails before opening a database when private pilot settings are incomplete", async () => {
    await expect(openOriMig04Pilot({})).rejects.toThrow("configuration is incomplete");
    await expect(
      openOriMig04Pilot({
        AGORIX_TUTOR_POSTGRES_URL: "postgresql://unreachable.invalid/test",
        AGORIX_ORI_DEPLOYMENT_ID: "pilot",
        AGORIX_ALLOWED_ADULT_EMAIL: "adult@example.test",
        ORI_REPO_PATH: "relative/path",
      }),
    ).rejects.toThrow("configuration is incomplete");
  });
});
