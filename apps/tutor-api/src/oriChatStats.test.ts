import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createOriChatStats } from "./oriChatStats.js";

describe("Ori chat stats", () => {
  it("counts by class and hour, and drops windows older than a day", () => {
    let time = Date.UTC(2026, 9, 26, 10, 5);
    const stats = createOriChatStats(() => time);
    stats.record("answered");
    stats.record("answered");
    stats.record("refused");
    time += 3_600_000;
    stats.record("fallback");
    expect(stats.snapshot().totals).toEqual({
      answered: 2,
      refused: 1,
      fallback: 1,
      "rate-limited": 0,
      invalid: 0,
    });
    expect(stats.snapshot().windows).toHaveLength(2);
    time += 25 * 3_600_000;
    expect(stats.snapshot().windows).toEqual([]);
  });

  it("exposes only counters and persists nothing", () => {
    const stats = createOriChatStats();
    stats.record("answered");
    expect(Object.keys(stats)).toEqual(["record", "snapshot"]);
    expect(JSON.stringify(stats.snapshot())).not.toMatch(/text|prompt|message/i);
    const source = readFileSync(new URL("./oriChatStats.ts", import.meta.url), "utf8");
    expect(source).not.toMatch(/node:fs|writeFile|localStorage|sqlite|\bfetch\b/);
  });
});
