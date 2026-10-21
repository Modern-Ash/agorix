import { describe, expect, it } from "vitest";
import { AI_HEALTH_PATH, fetchAiStatus, resolveAiStatus } from "./aiStatus.js";

function respond(body: string, init: { status?: number; contentType?: string } = {}) {
  return async () =>
    new Response(body, {
      status: init.status ?? 200,
      headers: { "content-type": init.contentType ?? "application/json" },
    });
}

describe("AI status (issue #352)", () => {
  it("uses a same-origin health path", () => {
    expect(AI_HEALTH_PATH).toBe("/api/tutor/health");
  });

  it("maps a health document to the four learner-facing states", () => {
    expect(resolveAiStatus(undefined)).toBe("local");
    expect(resolveAiStatus({ configured: false, available: false })).toBe("local");
    expect(resolveAiStatus({ configured: true, available: true })).toBe("active");
    expect(resolveAiStatus({ configured: true, available: false })).toBe("unavailable");
  });

  it("reports active only when the server says so", async () => {
    expect(await fetchAiStatus(respond('{"configured":true,"available":true}'))).toBe("active");
    expect(await fetchAiStatus(respond('{"configured":true,"available":false}'))).toBe(
      "unavailable",
    );
  });

  it("treats a missing endpoint as normal local mode, not an error", async () => {
    expect(await fetchAiStatus(respond("not found", { status: 404 }))).toBe("local");
    // The static host answers unknown paths with the app shell (HTML, 200).
    expect(await fetchAiStatus(respond("<!doctype html>", { contentType: "text/html" }))).toBe(
      "local",
    );
    expect(await fetchAiStatus(respond("{oops", { contentType: "application/json" }))).toBe(
      "local",
    );
  });

  it("falls back to local mode when the network fails", async () => {
    const failing = async () => {
      throw new TypeError("network down");
    };
    expect(await fetchAiStatus(failing)).toBe("local");
  });

  it("ignores documents with the wrong shape", async () => {
    expect(await fetchAiStatus(respond('{"configured":"yes"}'))).toBe("local");
    expect(await fetchAiStatus(respond("[]"))).toBe("local");
  });
});
