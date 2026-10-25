import { describe, expect, it } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterEach } from "vitest";
import {
  fetchGroupConfig,
  parseGroupLimits,
  readGroupConfig,
  readGroupConfigSource,
  startGroupConfigSync,
} from "./groupConfig.js";

// Issue #566: startup configuration for the optional closed groups.
const SECRET = "g".repeat(40);

describe("readGroupConfig", () => {
  it("is off when unset or empty, with or without the adult link", () => {
    expect(readGroupConfig({}, true)).toEqual({});
    expect(readGroupConfig({ AGORIX_GROUP_SECRET: "" }, false)).toEqual({});
  });

  it("enables with a long secret and the adult link", () => {
    expect(readGroupConfig({ AGORIX_GROUP_SECRET: SECRET }, true)).toEqual({ secret: SECRET });
  });

  it("fails fast on a short secret or without the adult link", () => {
    expect(() => readGroupConfig({ AGORIX_GROUP_SECRET: "short" }, true)).toThrow("32 characters");
    expect(() => readGroupConfig({ AGORIX_GROUP_SECRET: SECRET }, false)).toThrow(
      "AGORIX_LINK_SECRET",
    );
  });
});

const goodBody = {
  revision: 4,
  group: {
    limits: { maxChildren: 3, maxSessionMinutes: 60, joinCodeMinutes: 5, relayEnabled: false },
  },
};

describe("readGroupConfigSource", () => {
  it("is unset by default and accepts http, https and absolute unix sources", () => {
    expect(readGroupConfigSource({})).toBeUndefined();
    expect(readGroupConfigSource({ AGORIX_GROUP_CONFIG_URL: "" })).toBeUndefined();
    expect(readGroupConfigSource({ AGORIX_GROUP_CONFIG_URL: "http://127.0.0.1:8471/x" })).toBe(
      "http://127.0.0.1:8471/x",
    );
    expect(readGroupConfigSource({ AGORIX_GROUP_CONFIG_URL: "unix:/run/t.sock" })).toBe(
      "unix:/run/t.sock",
    );
  });

  it("fails fast on anything else", () => {
    for (const bad of ["ftp://x", "file:///etc/passwd", "not a url", "unix:relative.sock"]) {
      expect(() => readGroupConfigSource({ AGORIX_GROUP_CONFIG_URL: bad }), bad).toThrow();
    }
  });
});

describe("parseGroupLimits", () => {
  it("reads the three enforced limits and nothing else", () => {
    expect(parseGroupLimits(goodBody)).toEqual({
      revision: 4,
      limits: { maxChildren: 3, maxSessionMinutes: 60, joinCodeMinutes: 5 },
    });
  });

  it("ignores the whole response when any limit is missing, out of range or not an integer", () => {
    const withLimits = (limits: unknown) => ({ revision: 1, group: { limits } });
    const ok = goodBody.group.limits;
    for (const bad of [
      null,
      "x",
      {},
      { revision: 1 },
      { revision: "1", group: { limits: ok } },
      withLimits({ ...ok, maxChildren: 5 }),
      withLimits({ ...ok, maxChildren: 0 }),
      withLimits({ ...ok, maxChildren: 2.5 }),
      withLimits({ ...ok, maxSessionMinutes: 14 }),
      withLimits({ ...ok, joinCodeMinutes: 11 }),
      withLimits({ maxChildren: 3 }),
      withLimits({ ...ok, maxChildren: "3" }),
    ]) {
      expect(parseGroupLimits(bad), JSON.stringify(bad)).toBeUndefined();
    }
  });
});

describe("group config sync", () => {
  const servers: Server[] = [];
  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map((server) => new Promise((resolve) => server.close(resolve))),
    );
  });
  async function serve(handler: Parameters<typeof createServer>[1]) {
    const server = createServer(handler);
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    return `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/tutor/group-config`;
  }

  it("fetches over http and applies valid limits", async () => {
    const url = await serve((_, res) => {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify(goodBody));
    });
    const applied: unknown[] = [];
    const lines: string[] = [];
    const sync = startGroupConfigSync({
      source: url,
      apply: (limits) => applied.push(limits),
      log: (line) => lines.push(line),
      intervalMs: 3_600_000,
    });
    expect(await sync.refreshNow()).toBe(true);
    sync.stop();
    expect(applied.at(-1)).toEqual({ maxChildren: 3, maxSessionMinutes: 60, joinCodeMinutes: 5 });
    expect(lines).toContain("group config revision 4");
    expect(lines.join("\n")).not.toContain("maxChildren");
  });

  it("keeps the last good limits when the source fails, answers garbage or is too large", async () => {
    let mode: "ok" | "500" | "garbage" | "huge" = "ok";
    const url = await serve((_, res) => {
      if (mode === "500") {
        res.writeHead(500);
        res.end("boom");
      } else if (mode === "huge") {
        res.writeHead(200);
        res.end("x".repeat(300_000));
      } else {
        res.writeHead(200);
        res.end(mode === "ok" ? JSON.stringify(goodBody) : "{not json");
      }
    });
    const applied: unknown[] = [];
    const sync = startGroupConfigSync({
      source: url,
      apply: (limits) => applied.push(limits),
      intervalMs: 3_600_000,
    });
    expect(await sync.refreshNow()).toBe(true);
    for (const next of ["500", "garbage", "huge"] as const) {
      mode = next;
      expect(await sync.refreshNow(), next).toBe(false);
    }
    sync.stop();
    expect(applied.length).toBeGreaterThanOrEqual(1);
    expect(new Set(applied.map((item) => JSON.stringify(item))).size).toBe(1);
  });

  it("does not hang on a server that never answers", async () => {
    const url = await serve(() => undefined);
    await expect(fetchGroupConfig(url, 150)).rejects.toThrow();
  });

  it("reports an unreachable source as unavailable, not as an error", async () => {
    const lines: string[] = [];
    const sync = startGroupConfigSync({
      source: "http://127.0.0.1:1/api/tutor/group-config",
      apply: () => undefined,
      log: (line) => lines.push(line),
      intervalMs: 3_600_000,
    });
    expect(await sync.refreshNow()).toBe(false);
    sync.stop();
    expect(lines.some((line) => line.startsWith("group config unavailable"))).toBe(true);
  });
});
