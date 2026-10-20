import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const sw = readFileSync(fileURLToPath(new URL("../public/sw.js", import.meta.url)), "utf8");

describe("service worker cache boundaries", () => {
  it("never caches or replays private or live API responses", () => {
    for (const prefix of ["/v1/", "/api/", "/__dev/"]) {
      expect(sw, prefix).toContain(`url.pathname.startsWith("${prefix}")`);
    }
  });
});
