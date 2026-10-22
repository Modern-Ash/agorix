import { describe, expect, it } from "vitest";
import { fetchAdultAiHealth } from "./kidsAdultHealth.js";

describe("adult-only AI health", () => {
  it("reads safe status fields from the same-origin endpoint", async () => {
    const fetchImpl = async (path: string) => {
      expect(path).toBe("/api/tutor/health");
      return new Response(
        JSON.stringify({
          configured: true,
          available: false,
          providerInUse: "deterministic",
          lastErrorClass: "provider-unavailable",
          baseUrl: "http://secret.test",
          token: "secret",
        }),
        { headers: { "content-type": "application/json" } },
      );
    };
    expect(await fetchAdultAiHealth(fetchImpl)).toEqual({
      configured: true,
      available: false,
      providerInUse: "deterministic",
      lastErrorClass: "provider-unavailable",
    });
  });

  it("falls back to local mode when health is absent or malformed", async () => {
    expect(await fetchAdultAiHealth(async () => new Response("missing", { status: 404 }))).toEqual({
      configured: false,
      available: false,
      providerInUse: "deterministic",
      lastErrorClass: null,
    });
    expect(
      await fetchAdultAiHealth(
        async () =>
          new Response(
            JSON.stringify({
              configured: true,
              available: true,
              providerInUse: "http://secret.test",
              lastErrorClass: "raw failure",
            }),
            { headers: { "content-type": "application/json" } },
          ),
      ),
    ).toEqual({
      configured: false,
      available: false,
      providerInUse: "deterministic",
      lastErrorClass: null,
    });
  });

  it("recognizes host CLI providers without exposing a binary path", async () => {
    const health = await fetchAdultAiHealth(
      async () =>
        new Response(
          JSON.stringify({
            configured: true,
            available: true,
            providerInUse: "codex",
            lastErrorClass: null,
            binary: "/private/path",
          }),
          { headers: { "content-type": "application/json" } },
        ),
    );
    expect(health).toEqual({
      configured: true,
      available: true,
      providerInUse: "codex",
      lastErrorClass: null,
    });
  });
});
